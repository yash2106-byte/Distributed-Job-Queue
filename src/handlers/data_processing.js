const DataProcessing = async function dataprocessing(jobs) {
    console.log("an request to process a data",jobs);
    return {
        success: true,
        message: "Job executed successfully"
    };
    
}

export default DataProcessing;