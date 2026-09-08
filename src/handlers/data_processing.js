const DataProcessing = async function dataprocessing(jobs) {
    console.log("an request to process a data",jobs);
    await new Promise(resolve => setTimeout(resolve, 8000));
    return {
        success: true,
        message: "Job executed successfully"
    };
    
}

export default DataProcessing;