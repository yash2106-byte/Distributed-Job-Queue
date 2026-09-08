const ImageProcessing = async function imageprocessing(jobs) {
    console.log("an image request is generated",jobs);
    await new Promise(resolve => setTimeout(resolve, 8000));
    return {
        success: true,
        message: "Job executed successfully"
    };
    
    
}

export default ImageProcessing;