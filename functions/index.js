// functions/index.js

// Importo las herramientas de Firebase Functions,
// la base de datos y axios para hablar con Slack.

const {onDocumentCreated, onDocumentUpdated} =
 require("firebase-functions/v2/firestore");
const {log, error} = require("firebase-functions/logger");
const {defineString} = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

// Aquí defino que mi Bot Token de Slack
// es un secreto que se guarda en Firebase.
const slackBotToken = defineString("SLACK_BOT_TOKEN");

// Esta función usa el email de un usuario
// para preguntarle a Slack cuál es su ID de usuario.
// Es la clave para poder enviarles mensajes directos.

/**
 * @param {string} email
 * @return {string|null}
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

// Esta es mi función principal para enviar
//  un Mensaje Directo a un ID de usuario de Slack.

/**
 * @param {string} slackUserId
 * @param {string} text
 * @return {Promise}
 */
async function sendSlackDM(slackUserId, text) {
  const token = slackBotToken.value();
  if (!token || !slackUserId) {
    return Promise.resolve();
  }
  try {
    await axios.post("https://slack.com/api/chat.postMessage", {
      channel: slackUserId,
      text: text,
    }, {
      headers: {Authorization: `Bearer ${token}`},
    });
  } catch (err) {
    error(`Error al enviar DM al usuario ${slackUserId}:`,
        err.response?.data || err.message);
  }
}

// Una función útil para obtener los datos de cualquier
//  usuario de mi base de datos de Firebase.
/**
 * @param {string} firebaseUserId
 * @return {object|null}
 */
async function getUserData(firebaseUserId) {
  const userDoc = await admin.firestore()
      .collection("usuarios").doc(firebaseUserId).get();
  return userDoc.exists ? userDoc.data() : null;
}

// Esta función busca a todos los usuarios que tengan un rol específico.
// Es compatible con el sistema nuevo (lista de 'roles') y el antiguo ('rol').
/**
 * @param {string} role
 * @return {Array<object>}
 */
async function getUsersDataByRole(role) {
  const usersRef = admin.firestore().collection("usuarios");

  const singleRoleQuery = usersRef.where("rol", "==", role).get();
  const multiRoleQuery = usersRef.where("roles", "array-contains", role).get();

  const [singleRoleSnapshot, multiRoleSnapshot] = await Promise.all([
    singleRoleQuery,
    multiRoleQuery,
  ]);

  const usersMap = new Map();
  singleRoleSnapshot.forEach((doc) => usersMap.set(doc.id, doc.data()));
  multiRoleSnapshot.forEach((doc) => usersMap.set(doc.id, doc.data()));

  return Array.from(usersMap.values());
}

// Estas dos funciones nuevas borran o
// archivan un archivo en Storage a partir de su URL.
// Las uso para la limpieza automática.
/**
 * @param {string} fileUrl
 */
async function deleteFileFromUrl(fileUrl) {
  if (!fileUrl || !fileUrl.includes("firebasestorage.googleapis.com")) {
    log("URL de archivo inválida o vacía, no se puede borrar:", fileUrl);
    return;
  }
  try {
    const bucket = admin.storage().bucket();
    const decodedUrl = decodeURIComponent(fileUrl);
    const filePath = decodedUrl.split("/o/")[1].split("?")[0];

    await bucket.file(filePath).delete();
    log(`Archivo borrado exitosamente: ${filePath}`);
  } catch (err) {
    if (err.code === 404) {
      log(`El archivo no se encontró (probablemente ya fue borrado):
         ${fileUrl}`);
    } else {
      error(`Error al borrar el archivo ${fileUrl}:`, err);
    }
  }
}

/**
 * @param {string} fileUrl
 */
async function archiveFileToColdline(fileUrl) {
  if (!fileUrl || !fileUrl.includes("firebasestorage.googleapis.com")) {
    log("URL de archivo inválida o vacía, no se puede archivar:", fileUrl);
    return;
  }
  try {
    const bucket = admin.storage().bucket();
    const decodedUrl = decodeURIComponent(fileUrl);
    const filePath = decodedUrl.split("/o/")[1].split("?")[0];

    await bucket.file(filePath).setStorageClass("COLDLINE");
    log(`Archivo archivado a COLDLINE: ${filePath}`);
  } catch (err) {
    error(`Error al archivar el archivo ${fileUrl}:`, err);
  }
}

// -- MIS "VIGILANTES" (TRIGGERS) --

// 1. Vigilante de la Bitácora:
// Se activa cada vez que se crea un nuevo documento
// en "bitacoras_proyectos".
// Su trabajo es avisar a los supervisores por Slack.
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

// 2. Vigilante de los Proyectos:
// Este es el más importante. Se activa cada vez que un proyecto se actualiza.
// Revisa qué cambió (ej. el estado)
// para decidir qué notificación enviar y a quién.
// También se encarga de borrar/archivar archivos según el estado del proyecto.
exports.notifyProjectUpdate = onDocumentUpdated("proyectos/{projectId}",
    async (event) => {
      if (!event.data) return;

      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();

      const notifyRole = async (role, message) => {
        const users = await getUsersDataByRole(role);
        for (const user of users) {
          const slackUserId = await getSlackUserIdByEmail(user.email);
          if (slackUserId) await sendSlackDM(slackUserId, message);
        }
      };

      const notifyUsers = async (firebaseUserIds, message) => {
        for (const userId of firebaseUserIds) {
          const userData = await getUserData(userId);
          if (userData?.email) {
            const slackUserId = await getSlackUserIdByEmail(userData.email);
            if (slackUserId) await sendSlackDM(slackUserId, message);
          }
        }
      };

      if (beforeData.estado === "Cotización" && afterData.estado === "Activo") {
        const message = `✅ *Proyecto Activado* |
         El proyecto *${afterData.npu}* ` +
          `(${afterData.clienteNombre}) está listo para ser asignado.`;
        await notifyRole("supervisor", message);
      }

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

      if (
        beforeData.estado !== "Pendiente de Factura" &&
        afterData.estado === "Pendiente de Factura"
      ) {
        const message = `💰 *Listo para Facturar* |
         El proyecto *${afterData.npu}* ` +
          `ha sido aprobado y está pendiente de gestión de factura.`;
        await notifyRole("finanzas", message);
      }

      if (beforeData.estado !== "Facturado" &&
         afterData.estado === "Facturado") {
        const message = `🧾 *Proyecto Facturado* |
         Se han gestionado las facturas `+
          `para el proyecto *${afterData.npu}*.`;
        await notifyRole("supervisor", message);
        await notifyRole("finanzas", message);
      }

      const techsBefore = beforeData.asignadoTecnicosIds || [];
      const techsAfter = afterData.asignadoTecnicosIds || [];
      const newTechs = techsAfter.filter((id) => !techsBefore.includes(id));

      if (newTechs.length > 0) {
        const message = `➡️ *Nueva Asignación* |
         Se te ha asignado el proyecto ` +
          `*${afterData.npu}* (${afterData.servicioNombre}).`;
        await notifyUsers(newTechs, message);
      }

      if (
        beforeData.estado === "En Revisión Final" &&
        (afterData.estado === "Pendiente de Factura" ||
           afterData.estado === "Archivado")
      ) {
        log(`Proyecto ${afterData.npu} aprobado.
           Borrando evidencias de técnico.`);
        if (afterData.urlEvidenciaTecnico1) {
          await deleteFileFromUrl(afterData.urlEvidenciaTecnico1);
        }
        if (afterData.urlEvidenciaTecnico2) {
          await deleteFileFromUrl(afterData.urlEvidenciaTecnico2);
        }
      }

      if (beforeData.estado !== "Facturado" &&
         afterData.estado === "Facturado") {
        log(`Proyecto ${afterData.npu}
           facturado. Archivando documentos iniciales.`);
        const filesToArchive = [
          afterData.urlCotizacionCliente,
          afterData.urlPOCliente,
          afterData.urlCotizacionProveedor,
          afterData.urlPOProveedor,
        ];
        for (const fileUrl of filesToArchive) {
          await archiveFileToColdline(fileUrl);
        }
      }
    });

