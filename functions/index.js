// functions/index.js (Versión con Notificaciones Directas a Usuarios)

const {onDocumentCreated, onDocumentUpdated} =
 require("firebase-functions/v2/firestore");
const {log, error} = require("firebase-functions/logger");
const {defineString} = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

// NUEVO: Usamos el Bot Token en lugar del Webhook.
const slackBotToken = defineString("SLACK_BOT_TOKEN");

/**
 * Busca el ID de un usuario de Slack usando su dirección de email.
 * @param {string} email El email del usuario a buscar.
 * @return {string|null} El ID del usuario de Slack o null si no se encuentra.
 */
async function getSlackUserIdByEmail(email) {
  const token = slackBotToken.value();
  if (!token) {
    error("El Bot Token de Slack no está configurado.");
    return null;
  }
  try {
    const response = await axios.get(
        "https://slack.com/api/users.lookupByEmail", {
          headers: {Authorization: `Bearer ${token}`},
          params: {email},
        },
    );
    if (response.data.ok) {
      return response.data.user.id;
    }
    log("No se encontró usuario de Slack para el email:", email);
    return null;
  } catch (err) {
    error("Error al buscar usuario en Slack:", err.response?.data ||
         err.message);
    return null;
  }
}

/**
 * Envía un Mensaje Directo (DM) a un usuario específico de Slack.
 * @param {string} slackUserId El ID del usuario de Slack (ej. U123ABC456).
 * @param {string} text El mensaje a enviar.
 * @return {Promise}
 */
async function sendSlackDM(slackUserId, text) {
  const token = slackBotToken.value();
  if (!token || !slackUserId) {
    return Promise.resolve();
  }
  try {
    await axios.post("https://slack.com/api/chat.postMessage", {
      channel: slackUserId, // El ID del usuario funciona como un canal de DM
      text: text,
    }, {
      headers: {Authorization: `Bearer ${token}`},
    });
  } catch (err) {
    error(`Error al enviar DM al usuario ${slackUserId}:`,
        err.response?.data || err.message);
  }
}

/**
 * Obtiene los datos de un usuario desde Firestore.
 * @param {string} firebaseUserId El UID del usuario en Firebase.
 * @return {object|null} Los datos del usuario o null.
 */
async function getUserData(firebaseUserId) {
  const userDoc = await admin.firestore()
      .collection("usuarios").doc(firebaseUserId).get();
  return userDoc.exists ? userDoc.data() : null;
}

/**
 * Obtiene todos los usuarios de un rol específico.
 * @param {string} role El rol a buscar (ej. "supervisor").
 * @return {Array<object>} Una lista de los datos de los usuarios.
 */
async function getUsersDataByRole(role) {
  const usersSnapshot = await admin.firestore()
      .collection("usuarios").where("rol", "==", role).get();
  return usersSnapshot.docs.map((doc) => doc.data());
}


// --- LÓGICA DE NOTIFICACIONES ACTUALIZADA ---

exports.notifyNewLogEntry = onDocumentCreated("bitacoras_proyectos/{logId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const logData = snap.data();
      const projectDoc = await admin.firestore()
          .collection("proyectos").doc(logData.projectId).get();
      if (!projectDoc.exists) return;

      const projectData = projectDoc.data();
      const message = `📝 *Nueva Bitácora en ${projectData.npu}* | ` +
        `*${logData.autorNombre}* añadió una nota.`;

      // Notificar a todos los supervisores
      const supervisors = await getUsersDataByRole("supervisor");
      for (const supervisor of supervisors) {
        const slackUserId = await getSlackUserIdByEmail(supervisor.email);
        if (slackUserId) {
          await sendSlackDM(slackUserId, message);
        }
      }
    });


exports.notifyProjectUpdate = onDocumentUpdated("proyectos/{projectId}",
    async (event) => {
      if (!event.data) return;

      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();

      // Notificar a todos los usuarios de un rol
      const notifyRole = async (role, message) => {
        const users = await getUsersDataByRole(role);
        for (const user of users) {
          const slackUserId = await getSlackUserIdByEmail(user.email);
          if (slackUserId) await sendSlackDM(slackUserId, message);
        }
      };

      // Notificar a usuarios específicos por su ID de Firebase
      const notifyUsers = async (firebaseUserIds, message) => {
        for (const userId of firebaseUserIds) {
          const userData = await getUserData(userId);
          if (userData?.email) {
            const slackUserId = await getSlackUserIdByEmail(userData.email);
            if (slackUserId) await sendSlackDM(slackUserId, message);
          }
        }
      };

      // A. Proyecto Activado -> Notificar a Supervisores
      if (beforeData.estado === "Cotización" && afterData.estado === "Activo") {
        const message = `✅ *Proyecto Activado* |
         El proyecto *${afterData.npu}* ` +
          `(${afterData.clienteNombre}) está listo para ser asignado.`;
        await notifyRole("supervisor", message);
      }

      // B. Técnico Inicia Tarea -> Notificar a Supervisores
      const techStatusAfter = afterData.tecnicosStatus || {};
      for (const techId in techStatusAfter) {
        if (
          techStatusAfter[techId] === "En Proceso" &&
          (beforeData.tecnicosStatus?.[techId] !== "En Proceso")
        ) {
          const techData = await getUserData(techId);
          const techName = techData ? techData.nombreCompleto : "un técnico";
          const message = `▶️ *Tarea Iniciada* |
           *${techName}* ha comenzado a ` +
            `trabajar en el proyecto *${afterData.npu}*.`;
          await notifyRole("supervisor", message);
          break;
        }
      }

      // C. Tarea Finalizada -> Notificar a Supervisores y Practicantes
      if (
        beforeData.estado !== "Terminado Internamente" &&
        afterData.estado === "Terminado Internamente"
      ) {
        const message = `🏁 *Tarea Finalizada* |
         El proyecto *${afterData.npu}* ` +
          `está listo para documentación.`;
        await notifyRole("supervisor", message);
        await notifyRole("practicante", message);
      }

      // D. Listo para Facturar -> Notificar a Finanzas
      if (
        beforeData.estado !== "Pendiente de Factura" &&
        afterData.estado === "Pendiente de Factura"
      ) {
        const message = `💰 *Listo para Facturar* |
         El proyecto *${afterData.npu}* ` +
          `ha sido aprobado y está pendiente de gestión de factura.`;
        await notifyRole("finanzas", message);
      }

      // E. Proyecto Facturado -> Notificar a Supervisores y Finanzas
      if (beforeData.estado !== "Facturado" &&
         afterData.estado === "Facturado") {
        const message = `🧾 *Proyecto Facturado* |
         Se han gestionado las facturas `+
          `para el proyecto *${afterData.npu}*.`;
        await notifyRole("supervisor", message);
        await notifyRole("finanzas", message);
      }

      // F. Nueva Asignación -> Notificar a los nuevos técnicos asignados
      const techsBefore = beforeData.asignadoTecnicosIds || [];
      const techsAfter = afterData.asignadoTecnicosIds || [];
      const newTechs = techsAfter.filter((id) => !techsBefore.includes(id));

      if (newTechs.length > 0) {
        const message = `➡️ *Nueva Asignación* |
         Se te ha asignado el proyecto ` +
          `*${afterData.npu}* (${afterData.servicioNombre}).`;
        await notifyUsers(newTechs, message);
      }
    });
