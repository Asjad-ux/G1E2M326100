import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { success, message } from '../utils/response.js';
export const list=async(req:Request,res:Response)=>success(res,await prisma.notification.findMany({where:{userId:req.auth!.userId},orderBy:{createdAt:'desc'}}));
export const read=async(req:Request,res:Response)=>success(res,await prisma.notification.updateMany({where:{id:String(req.params.id),userId:req.auth!.userId},data:{read:true}}));
export const readAll=async(req:Request,res:Response)=>{await prisma.notification.updateMany({where:{userId:req.auth!.userId,read:false},data:{read:true}});return message(res,'Notifications marked as read');};
