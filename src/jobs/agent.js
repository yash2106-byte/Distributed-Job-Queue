const Agent1 = async function agent1(job) {

    console.log("Agent started:", job);

    // Simulate AI/job processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("Agent finished");

    return {
        success: true,
        result: "Job executed successfully"
    };
}

export default Agent1;