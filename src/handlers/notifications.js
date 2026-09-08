const Notification = async function notification(jobs) {
    console.log("an notification is recived",jobs);
    return {
        success: true,
        message: "Job executed successfully"
    };
    
}

export default Notification;