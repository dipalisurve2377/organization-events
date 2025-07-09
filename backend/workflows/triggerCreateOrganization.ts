import {getTemporalClient} from "../../temporal/client.js"

import {createOrganizationWorkflow,CreateOrganizationInput} from "../../temporal/workflows/createOrganizationWorkflow.js"

export const triggerCreateOrganization=async(input:CreateOrganizationInput)=>{

    const client=await getTemporalClient();

    const handle=await client.start(createOrganizationWorkflow,{
        taskQueue:"organization-task-queue",
        workflowId:`create-org-${input.identifier}`,
        args:[input]
    });

    console.log(`Started workflow : ${handle.workflowId}`);
    return handle.workflowId;
}