import type { Request, Response } from 'express';
import * as service from '../services/document.service.js';
import { success, message } from '../utils/response.js';
export const create=async(req:Request,res:Response)=>success(res,await service.createDocument(req.auth!.userId,req.body),201);
export const list=async(req:Request,res:Response)=>success(res,await service.listDocuments(req.auth!.userId));
export const get=async(req:Request,res:Response)=>success(res,await service.getDocument(req.auth!.userId,String(req.params.id)));
export const patch=async(req:Request,res:Response)=>success(res,await service.updateDocument(req.auth!.userId,String(req.params.id),req.body));
export const remove=async(req:Request,res:Response)=>{await service.deleteDocument(req.auth!.userId,String(req.params.id));return message(res,'Document deleted');};
export const attach=async(req:Request,res:Response)=>success(res,await service.attachApplicationDocument(req.auth!.userId,String(req.params.applicationId),req.body),201);
