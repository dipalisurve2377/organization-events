import { proxyActivities } from "@temporalio/workflow";

import type * as activities from "../activities/activities.ts"

export interface UpdateOrganizationInput{
    orgId:string;
    name?:string;
    identifier?:string;
    createdByEmail:string
}


const {updateOrganizationInAuth0,updateOrganizationStatus,sendNotificationEmail}=proxyActivities<typeof activities>({
    startToCloseTimeout:'10 seconds',
})


export async function updateOrganizationWorkflow(input:UpdateOrganizationInput):Promise<void>{
    const {orgId,name,identifier,createdByEmail}=input;
    try {

        await updateOrganizationStatus(orgId,'updating');
        // update in auth0
        await updateOrganizationInAuth0(orgId,name,identifier);

        // update status
        await updateOrganizationStatus(orgId,"updated");
       
        // send mail that org is updated to the user
         await sendNotificationEmail(createdByEmail, name || "Your organization",'updated');

    } catch (error) {
        console.error("Update Organization Workflow failed",error);
        await updateOrganizationStatus(orgId,"failed");
    }
}