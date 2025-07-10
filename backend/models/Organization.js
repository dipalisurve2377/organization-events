import mongoose from "mongoose";

const organizationSchema=new mongoose.Schema({

    name:{
        type:String,
        required:true,        
    },
    identifier:{
        type:String,
        required:true,
        unique:true,
    },
    createdByEmail:{
        type:String,
        required:true,
    },
    status:{
        type:String,
        enum: ['provisioning', 'updating', 'deleting', 'success', 'failed', 'updated', 'deleted'],
        default:'provisining'
    }
},

{
    timestamps:true
}
);

const Organization=mongoose.model('Organization',organizationSchema);

export default Organization;