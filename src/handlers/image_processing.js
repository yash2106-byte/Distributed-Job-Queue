const ImageProcessing = async function imageprocessing(jobs) {
    console.log("an image request is generated",jobs);
    return {
        success: true,
        message: "Job executed successfully"
    };
    
    
}

export default ImageProcessing;