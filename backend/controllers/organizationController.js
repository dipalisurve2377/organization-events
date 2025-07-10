
import {triggerCreateOrganization} from "../workflows/triggerCreateOrganization.ts"
import {triggerUpdateOrganization} from "../workflows/triggerUpdateOrganization.ts"

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


export const updateOrganizationController=async(req,res)=>{
  const{orgId,name,identifier,createdByEmail}=req.body;

  if(!orgId || !createdByEmail)
  {
    return res.status(400).json({error:'Organization ID  any createdByEmail is required'});
  }

  try {
    const workflowId= await triggerUpdateOrganization({orgId,name,identifier,createdByEmail});
        res.status(200).json({ message: "Organization update started", workflowId });
  } catch (error) {
   console.error("Error starting update workflow:", error);
    res.status(500).json({ error: "Failed to start organization update workflow" }); 
  }
}