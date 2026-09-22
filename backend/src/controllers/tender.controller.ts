import type { Request, Response } from 'express';
import { TenderStatus } from '@prisma/client';
import * as service from '../services/tender.service.js';
import { prisma } from '../lib/prisma.js';
import { success, message } from '../utils/response.js';

async function officerProfileId(userId:string){ const p=await prisma.officerProfile.findUnique({where:{userId}}); if(!p) throw new Error('Officer profile not found'); return p.id; }
export const create=async(req:Request,res:Response)=>success(res,await service.createTender(await officerProfileId(req.auth!.userId),req.body),201);
export const list=async(req:Request,res:Response)=>success(res,await service.listTenders(await officerProfileId(req.auth!.userId),req.query));
export const get=async(req:Request,res:Response)=>success(res,await service.getTender(String(req.params.id)));
export const getActive=async(req:Request,res:Response)=>success(res,await service.getActiveTender(String(req.params.id)));
export const patch=async(req:Request,res:Response)=>success(res,await service.updateTender(await officerProfileId(req.auth!.userId),String(req.params.id),req.body));
export const publish=async(req:Request,res:Response)=>success(res,await service.changeTenderStatus(await officerProfileId(req.auth!.userId),String(req.params.id),TenderStatus.ACTIVE));
export const close=async(req:Request,res:Response)=>success(res,await service.changeTenderStatus(await officerProfileId(req.auth!.userId),String(req.params.id),TenderStatus.CLOSED));
export const remove=async(req:Request,res:Response)=>{await service.deleteTender(await officerProfileId(req.auth!.userId),String(req.params.id));return message(res,'Tender deleted');};
export const active=async(_req:Request,res:Response)=>success(res,await service.listActiveTenders());
export const addRequirement=async(req:Request,res:Response)=>success(res,await service.addRequirement(String(req.params.tenderId),req.body),201);
export const requirements=async(req:Request,res:Response)=>success(res,await service.listRequirements(String(req.params.tenderId)));
export const patchRequirement=async(req:Request,res:Response)=>success(res,await service.updateRequirement(String(req.params.id),req.body));
export const deleteRequirement=async(req:Request,res:Response)=>{await service.deleteRequirement(String(req.params.id));return message(res,'Requirement deleted');};
