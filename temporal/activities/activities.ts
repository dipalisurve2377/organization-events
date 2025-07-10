import mongoose from "mongoose";
import nodemailer from "nodemailer";

import dotenv from "dotenv"

dotenv.config();

let connected=false;

const connectDB=async()=>{
    if(!connected)
    {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://dipali:organization2000@cluster0.l9sxobd.mongodb.net/');
        connected=true;
    }

};


const organizationSchema= new mongoose.Schema({
    name:String,
    identifier:{type:String,unique:true},
    createdByEmail:String,
    status:{
        type: String,
      enum: ['provisioning', 'updating', 'deleting', 'success', 'failed', 'updated', 'deleted'],
      default: 'provisioning',
    }
},{
    timestamps:true
})


const Organization=mongoose.models.Organization || mongoose.model('Organization',organizationSchema);


 // create organization

    export const createOrganizationRecord=async(name:string,identifier:string,createdByEmail:string):Promise<string>=>{


        await connectDB();
        const org=await Organization.create({
            name,
            identifier,
            createdByEmail,
            status:'provisioning'
        });

        console.log('Organization created successfully',org._id);
        return org._id.toString();

    }

    
    // sending email to the user

    export const sendNotificationEmail=async(to:string,name:string,action:'created' | 'updated' | 'deleted' = 'created'):Promise<void>=>{

        const transporter= nodemailer.createTransport({
            service:'gmail',
            auth:{
                user:process.env.EMAIL_USER,
                pass:process.env.EMAIL_PASS ,
            }
        });

        await transporter.sendMail({
            from:process.env.EMAIL_USER,
            to,
            subject:`Organization ${action}`,
            text: `Hello, your organization has been successfully ${action} to "${name}" .`,
        });

        console.log(`Notification email sent to ${to} for action ${action}`);
    }


    // update the organization status

    export const updateOrganizationStatus=async(orgId:string,status:string):Promise<void>=>{

        await connectDB();
        await Organization.findByIdAndUpdate(orgId,{status});
        console.log(`Organization status updated to "${status}" for ${orgId}`);
    }
    
    // update updateOrganizationRecord

    export const updateOrganizationRecord=async(
        orgId:string,
        name?:string,
        identifier?:string,
        
    ):Promise<void>=>{
        await connectDB();

        const updateFields:any={};

        if(name) updateFields.name=name;
        if(identifier) updateFields.identifier=identifier;

        await Organization.findByIdAndUpdate(orgId,updateFields,{new:true});

        console.log(`Organization ${orgId} has been updated`);
    }
    