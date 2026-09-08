const sendEmail = async function sendemail(jobs) {
    console.log("an email request is recived",jobs);
    await new Promise(resolve => setTimeout(resolve, 8000));
    return {
        success: true,
        message: "Job executed successfully"
    };
    
}

export default sendEmail;