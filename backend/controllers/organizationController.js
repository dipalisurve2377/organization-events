
import {triggerCreateOrganization} from "../workflows/triggerCreateOrganization.ts"
export const createOrganizationController=async (req,res)=>{
    const {name,identifier,createdByEmail}=req.body;

     if (!name || !identifier || !createdByEmail) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

    try {
   const workflowId = await triggerCreateOrganization({ name, identifier, createdByEmail });
    res.status(200).json({ message: 'Organization provisioning started', workflowId });

    } catch (error) {
     console.error('Error starting organization workflow:', error);
    res.status(500).json({ error: 'Failed to start organization creation workflow' });   
    }
}