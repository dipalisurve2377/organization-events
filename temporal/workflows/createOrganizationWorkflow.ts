import { proxyActivities } from '@temporalio/workflow';
import type * as activities from "../activities/activities.ts"


export interface CreateOrganizationInput {
  name: string;
  identifier: string;
  createdByEmail: string;
}

const { createOrganizationRecord, sendNotificationEmail, updateOrganizationStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
});


export async function createOrganizationWorkflow(input:CreateOrganizationInput):Promise<void>{

    const {name,identifier,createdByEmail}=input;

    try {
        // create and save the orgid in db
        const orgId= await createOrganizationRecord(name,identifier,createdByEmail);
         await sendNotificationEmail(createdByEmail, name);
        await updateOrganizationStatus(orgId,"success");

    } catch (error) {
     console.error('Workflow failed:', error);   
    }
}