const Reports = async function reports(jobs) {
    console.log("an report is recived",jobs);
    return {
        success: true,
        message: "Job executed successfully"
    };
    
    
}

export default Reports;