import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { SelectionService } from '../selection.service';

@Injectable()
export class VerifySurl implements CanActivate {
  @Inject(SelectionService)
  private readonly selectionService: SelectionService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {



    return true;
  }
}
