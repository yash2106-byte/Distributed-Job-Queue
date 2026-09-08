const Reports = async function reports(jobs) {
    console.log("an report is recived",jobs);
    await new Promise(resolve => setTimeout(resolve, 8000));
    return {
        success: true,
        message: "Job executed successfully"
    };
    
    
}

export default Reports;