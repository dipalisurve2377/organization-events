import { getTemporalClient } from "../../temporal/client";
import { updateOrganizationWorkflow,UpdateOrganizationInput } from "../../temporal/workflows/updateOrganizationWorkflow";

export const triggerUpdateOrganization=async (input:UpdateOrganizationInput)=>{

    const client= await getTemporalClient();

    const handle= await client.start(updateOrganizationWorkflow,{
        taskQueue:'organization-task-queue',
        workflowId:`update-org-${input.orgId}`,
        args:[input],
    });
    

    console.log(`Started update workflow: ${handle.workflowId}`);

    return handle.workflowId;
}