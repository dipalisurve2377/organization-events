import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "../activities/activities.ts"


export interface DeleteOrganizationInput{
    orgId:string;
    createdByEmail:string;
    name?:string;
}


const {updateOrganizationStatus,sendNotificationEmail,getOrganizationNameById,deleteOrganizationInAuth0}= proxyActivities<typeof activities>({
    startToCloseTimeout:'10 seconds'
});

export async function deleteOrganizationWorkflow(input:DeleteOrganizationInput):Promise<void>{

    const {orgId,createdByEmail,name}=input;

    try {

        const orgName = await getOrganizationNameById(orgId); 
        
        await updateOrganizationStatus(orgId,'deleting');

        await deleteOrganizationInAuth0(orgId);

        await updateOrganizationStatus(orgId,'deleted')

        await sendNotificationEmail(createdByEmail,orgName || "Your Organizatioin","deleted");
    } catch (error) {
     
    console.error("Delete Organization Workflow failed:", error);
    await updateOrganizationStatus(orgId, "failed");   
    }
}