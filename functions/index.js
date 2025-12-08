// functions/index.js (notificaciones pop ups)

const {onDocumentCreated, onDocumentUpdated} =
 require("firebase-functions/v2/firestore");
const {onValueUpdated} = require("firebase-functions/v2/database");
const {log, error} = require("firebase-functions/logger");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

const PROYECTOS_COLLECTION = "proyectos_v2";
const slackBotToken = defineSecret("SLACK_BOT_TOKEN");

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
    const response = await axios.get("https://slack.com/api/users.lookupByEmail", {
      headers: {Authorization: `Bearer ${token}`},
      params: {email},
    });
    if (response.data.ok) {
      return response.data.user.id;
    }
    log("No se encontró usuario de Slack para el email:", email);
    return null;
  } catch (err) {
    error(`Error al buscar usuario en Slack (${email}):`,
        err.response?.data || err.message);
    return null;
  }
}

/**
 * Envía un Mensaje Directo (DM) a un usuario específico de Slack.
 * @param {string} slackUserId El ID del usuario de Slack (ej. U123ABC4S).
 * @param {string} text El mensaje a enviar.
 * @return {Promise<void>}
 */
async function sendSlackDM(slackUserId, text) {
  const token = slackBotToken.value();
  if (!token || !slackUserId) return;
  try {
    await axios.post("https://slack.com/api/chat.postMessage", {
      channel: slackUserId, text: text,
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
  const userDoc =
   await admin.firestore().collection("usuarios").doc(firebaseUserId).get();
  return userDoc.exists ? {id: userDoc.id, ...userDoc.data()} : null;
}

/**
 * Obtiene todos los usuarios de un rol específico,
 * @param {string} role El rol a buscar (ej. "supervisor").
 * @return {Array<object>} Una lista de los datos de los usuarios.
 */
async function getUsersDataByRole(role) {
  const usersRef = admin.firestore().collection("usuarios");
  const singleRoleQuery = usersRef.where("rol", "==", role).get();
  const multiRoleQuery = usersRef.where("roles", "array-contains", role).get();
  const [singleRoleSnapshot, multiRoleSnapshot] =
   await Promise.all([singleRoleQuery, multiRoleQuery]);
  const usersMap = new Map();
  singleRoleSnapshot.forEach((doc) =>
    usersMap.set(doc.id, {id: doc.id, ...doc.data()}));
  multiRoleSnapshot.forEach((doc) =>
    usersMap.set(doc.id, {id: doc.id, ...doc.data()}));
  return Array.from(usersMap.values());
}

/**
 * Borra un archivo en Cloud Storage a partir de su URL de descarga.
 * @param {string} fileUrl La URL completa del archivo a borrar.
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
      log(`El archivo no se encontró: ${fileUrl}`);
    } else {
      error(`Error al borrar el archivo ${fileUrl}:`, err);
    }
  }
}

/**
 * Cambia la clase de almacenamiento de un archivo a COLDLINE.
 * @param {string} fileUrl La URL completa del archivo a archivar.
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

exports.notifyNewLogEntry = onDocumentCreated({
  document: "bitacoras_proyectos/{logId}",
  secrets: [slackBotToken],
}, async (event) => {
  const snap = event.data;
  if (!snap) return;
  const logData = snap.data();
  const projectDoc =
  await admin.firestore()
      .collection(PROYECTOS_COLLECTION).doc(logData.projectId).get();
  if (!projectDoc.exists) return;
  const projectData = projectDoc.data();

  const supervisors = await getUsersDataByRole("supervisor");
  const message =
  `*Nueva Bitácora en ${projectData.npu}* |
   *${logData.autorNombre}* añadió una nota.`;

  for (const supervisor of supervisors) {
    if (supervisor && supervisor.email) {
      const slackUserId = await getSlackUserIdByEmail(supervisor.email);
      if (slackUserId) await sendSlackDM(slackUserId, message);
    }
  }
});

exports.cleanupReadNotifications =
 onDocumentUpdated("notificaciones/{notifId}", async (event) => {
   const afterData = event.data.after.data();
   if (afterData.read === true) {
     await event.data.after.ref.delete();
   }
 });

exports.notifyProjectUpdate = onDocumentUpdated({
  document: PROYECTOS_COLLECTION + "/{projectId}",
  secrets: [slackBotToken],
}, async (event) => {
  if (!event.data) return;
  const projectId = event.params.projectId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  const notifyRole = async (role, message) => {
    const users = await getUsersDataByRole(role);
    for (const user of users) {
      if (user && user.email) {
        const slackUserId = await getSlackUserIdByEmail(user.email);
        if (slackUserId) await sendSlackDM(slackUserId, message);
      }
    }
  };
  const notifyUsers = async (firebaseUserIds, message) => {
    for (const userId of firebaseUserIds) {
      const userData = await getUserData(userId);
      if (userData && userData.email) {
        const slackUserId = await getSlackUserIdByEmail(userData.email);
        if (slackUserId) await sendSlackDM(slackUserId, message);
      }
    }
  };

  if (beforeData.estado === "Cotización" && afterData.estado === "Activo") {
    const message =
     `Proyecto Activado: ${afterData.npu} está listo para ser asignado.`;
    await notifyRole("supervisor", message);
  }

  const techsBefore = beforeData.asignadoTecnicosIds || [];
  const techsAfter = afterData.asignadoTecnicosIds || [];
  const newTechs = techsAfter.filter((id) => !techsBefore.includes(id));
  if (newTechs.length > 0) {
    await notifyUsers(newTechs, `➡️ *Nueva Tarea:* 
      Se te ha asignado el proyecto ${afterData.npu}.`);
  }

  const priorityBefore = beforeData.prioridad || "1 - Normal";
  const priorityAfter = afterData.prioridad || "1 - Normal";

  if (priorityBefore !== priorityAfter) {
    const priorityText = priorityAfter.split(" - ")[1] || priorityAfter;
    await notifyUsers(techsAfter, `🚩 *Prioridad Actualizada:*
       El proyecto ${afterData.npu} ahora tiene prioridad *${priorityText}*.`);
  }

  const techStatusAfter = afterData.tecnicosStatus || {};
  for (const techId in techStatusAfter) {
    if (
      techStatusAfter[techId] === "En Proceso" &&
      (beforeData.tecnicosStatus?.[techId] !== "En Proceso")
    ) {
      const techData = await getUserData(techId);
      const techName = techData ? techData.nombreCompleto : "un técnico";
      const message = `Tarea Iniciada: El técnico ${techName}
       ha comenzado a trabajar en ${afterData.npu}.`;
      await notifyRole("supervisor", message);
      break;
    }
  }

  if (beforeData.estado !== "Terminado Internamente" &&
    afterData.estado === "Terminado Internamente") {
    const message = `Tarea Finalizada: El proyecto $
    {afterData.npu} está listo para documentación.`;
    await notifyRole("supervisor", message);
    await notifyRole("practicante", message);
  }

  if (beforeData.estado !== "Pendiente de Factura" &&
     afterData.estado === "Pendiente de Factura") {
    const message =
      `Listo para Facturar: El proyecto ${afterData.npu} ha sido aprobado.`;
    await notifyRole("finanzas", message);
  }

  if (beforeData.estado !== "Facturado" && afterData.estado === "Facturado") {
    const message = `Proyecto Facturado: Se han gestionado las facturas para $
     {afterData.npu}.`;
    await notifyRole("supervisor", message);
    await notifyRole("finanzas", message);
  }

  if (newTechs.length > 0) {
    const message =
      `Nueva Tarea: Se te ha asignado el proyecto ${afterData.npu}.`;
    await notifyUsers(newTechs, message);
  }

  if (beforeData.estado === "En Revisión Final" && (afterData.estado ===
     "Pendiente de Factura" || afterData.estado === "Archivado")) {
    log(`Proyecto ${afterData.npu} aprobado. Borrando evidencias de técnico.`);
    if (afterData
        .urlEvidenciaTecnico1
    ) await deleteFileFromUrl(afterData.urlEvidenciaTecnico1);
    if (afterData
        .urlEvidenciaTecnico2
    ) await deleteFileFromUrl(afterData.urlEvidenciaTecnico2);
  }

  if (beforeData.estado !== "Facturado" && afterData.estado === "Facturado") {
    log(`Proyecto ${afterData.npu}
       facturado. Archivando documentos iniciales.`);
    const filesToArchive =
      [afterData.urlCotizacionCliente, afterData.urlPOCliente,
        afterData.urlCotizacionProveedor, afterData.urlPOProveedor];
    for (const fileUrl of filesToArchive) {
      await archiveFileToColdline(fileUrl);
    }
  }

  const wasInReview = beforeData.estado === "En Revisión Final";
  const isApproved = afterData.estado ===
   "Activo" || afterData.estado === "Terminado" || afterData.estado ===
    "Pendiente de Factura";

  if (wasInReview && isApproved) {
    log(`Proyecto ${projectId}
       aprobado. Iniciando limpieza de datos técnicos.`);

    const logsQuery = admin.firestore().collection(
        "bitacoras_proyectos").where("projectId", "==", projectId);
    const logsSnap = await logsQuery.get();
    const batch = admin.firestore().batch();
    logsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    log(`Bitácora limpiada: ${logsSnap.size} entradas eliminadas.`);

    const updateCleanFields = {};

    if (beforeData.fase1_urlEvidencia) {
      await deleteFileFromUrl(beforeData.fase1_urlEvidencia);
      updateCleanFields.fase1_urlEvidencia =
       admin.firestore.FieldValue.delete();
    }
    if (beforeData.fase2_urlEvidencia) {
      await deleteFileFromUrl(beforeData.fase2_urlEvidencia);
      updateCleanFields.fase2_urlEvidencia =
       admin.firestore.FieldValue.delete();
    }

    if (Object.keys(updateCleanFields).length > 0) {
      await event.data.after.ref.update(updateCleanFields);
    }
  }
});

/**
 * Se activa cuando se crea un nuevo registro de tiempo.
 * Calcula la duración y la suma al total de horas registradas del proyecto.
 */
exports.processTimeLog = onDocumentCreated("registrosDeTiempo/{logId}",
    async (event) => {
      const snap = event.data;
      if (!snap) {
        log("No hay datos en el evento de registro de tiempo.");
        return;
      }

      const logData = snap.data();
      const {projectId, fechaInicio, fechaFin} = logData;

      if (!projectId || !fechaInicio) {
        log("Registro de tiempo inválido (falta projectId o fechaInicio).",
            logData);
        return;
      }
      if (!fechaFin) {
        log("Registro de tiempo incompleto (falta fechaFin), no se procesará.",
            logData);
        return;
      }

      try {
        const startTime = (typeof fechaInicio.toDate === "function") ?
         fechaInicio.toDate() : new Date(fechaInicio);
        const endTime = (typeof fechaFin.toDate === "function") ?
         fechaFin.toDate() : new Date(fechaFin);

        const durationInMillis = endTime.getTime() - startTime.getTime();

        if (durationInMillis <= 0) {
          log(`Duración no válida (${durationInMillis}ms) para ${projectId}.`);
          return;
        }

        const durationInHours = durationInMillis / (1000 * 60 * 60);
        const projectRef =
         admin.firestore().collection(PROYECTOS_COLLECTION).doc(projectId);

        await projectRef.update({
          horasRegistradas:
           admin.firestore.FieldValue.increment(durationInHours),
        });

        log(`Se añadieron ${durationInHours.toFixed(2)}
         horas al proyecto ${projectId}.`);
      } catch (err) {
        error(`Error al procesar el registro de tiempo ${snap.id}:`, err);
      }
    });

/**
 * Se activa cuando cambia el estado de un usuario en RTDB.
 */
exports.onUserStatusChanged =
 onValueUpdated("/status/{userId}", async (event) => {
   const statusData = event.data.after.val();
   if (!statusData || statusData.state !== "offline") {
     log(`Usuario ${event.params.userId}
       no está offline. No se requiere acción.`);
     return;
   }

   const activeProjectId = statusData.activeProjectId;
   const activeTaskStart = statusData.activeTaskStart;

   if (activeProjectId && activeTaskStart) {
     log(`Usuario ${event.params.userId}
       se desconectó con tarea activa. Pausando...`);

     const userFirestoreRef =
      admin.firestore().collection("usuarios").doc(event.params.userId);
     const timeLogRef = admin.firestore().collection("registrosDeTiempo").doc();
     const projectRef =
      admin.firestore().collection(PROYECTOS_COLLECTION).doc(activeProjectId);

     try {
       await timeLogRef.set({
         tecnicoId: event.params.userId,
         projectId: activeProjectId,
         fechaInicio: activeTaskStart,
         fechaFin: statusData.last_changed,
       });

       const startTime = activeTaskStart.toDate();
       const endTime = new Date(statusData.last_changed);
       const durationInMillis = endTime.getTime() - startTime.getTime();
       if (durationInMillis > 0) {
         const durationInHours = durationInMillis / (1000 * 60 * 60);
         await projectRef.update({
           horasRegistradas:
            admin.firestore.FieldValue.increment(durationInHours),
         });
         log(`Added ${durationInHours.toFixed(2)}
          hours to project ${activeProjectId} due to disconnect.`);
       }

       await userFirestoreRef.update({
         tareaActiva: admin.firestore.FieldValue.delete(),
       });

       log(`Tarea activa del usuario ${event.params.userId}
         pausada con éxito.`);
     } catch (err) {
       error(`Error procesando estado offline para usuario 
              ${event.params.userId}:`, err);
     }
   } else {
     log(`Usuario ${event.params.userId} se desconectó sin tarea activa.`);
   }
 });
