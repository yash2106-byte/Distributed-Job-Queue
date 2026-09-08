const Notification = async function notification(jobs) {
    console.log("an notification is recived",jobs);
    await new Promise(resolve => setTimeout(resolve, 8000));
    return {
        success: true,
        message: "Job executed successfully"
    };
    
}

export default Notification;