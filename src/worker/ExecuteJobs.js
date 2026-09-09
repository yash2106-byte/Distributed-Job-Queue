import sendEmail from "../handlers/sendEmail.js";
import Reports from "../handlers/reports.js";
import Notification from "../handlers/notifications.js";
import ImageProcessing from "../handlers/image_processing.js";
import DataProcessing from "../handlers/data_processing.js";

const ExecuteJob = async function executeJob(queue, payload) {

    switch (queue) {

        case "emails":
            return await sendEmail(payload);

        case "notifications":
            return await Notification(payload);

        case "reports":
            return await Reports(payload);

        case "data_processing":
            return await DataProcessing(payload);

        case "image_processing":
            return await ImageProcessing(payload);

        default:
            throw new Error(`Unknown queue: ${queue}`);
    }
};

export default ExecuteJob;