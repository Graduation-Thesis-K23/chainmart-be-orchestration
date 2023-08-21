import { Controller, Inject, OnModuleInit, UseFilters } from '@nestjs/common';
import {
  ClientKafka,
  EventPattern,
  MessagePattern,
} from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';

import { ExceptionFilter } from 'src/filters/rpc-exception.filter';

@Controller()
@UseFilters(new ExceptionFilter())
export class OrdersController implements OnModuleInit {
  constructor(
    @Inject('BATCH_SERVICE')
    private readonly batchClient: ClientKafka,

    @Inject('ORDER_SERVICE')
    private readonly orderClient: ClientKafka,

    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const topics = ['package', 'checkavailable'];
    topics.forEach((topic) => {
      this.batchClient.subscribeToResponseOf(`batches.${topic}`);
    });
    await this.batchClient.connect();
  }

  @MessagePattern('orchestration.health-check')
  async healthCheck() {
    console.log('orchestration.health-check received');
    return 'orchestration service is working';
  }

  @EventPattern('orchestration.orders.created')
  async checkBatchesAvailable(order: any) {
    const $batchResponse = this.batchClient
      .send('batches.checkavailable', order.order_details)
      .pipe(timeout(60000));
    const result = await lastValueFrom($batchResponse);
    console.log('result', result);
  }

  @EventPattern('orchestration.orders.paid')
  async processOrder(order: any) {
    console.log('orchestration.orders.paid', order);
    try {
      const $batchResponse = this.batchClient
        .send('batches.package', order.order_details)
        .pipe(timeout(60000));
      const batchResponse = await lastValueFrom($batchResponse);
      // batches.order_status === 'Approved'
      // batches.branch_id === branch should be same as order.branch_id
      console.log('batchResponse', batchResponse);

      if (batchResponse.order_status === 'Approved') {
        // this.orderClient.emit('orders.packaged', order.id);
        this.orderClient.emit('orders.approveorderbyemployee', {
          phone: 'BOT',
          order_id: order.id,
          branch_id: batchResponse.branch_id,
        });
        this.notificationClient.emit('notification.orderapproved', order);
      } else {
        throw new Error(`Failed to approved order id(${order.id})`);
      }
    } catch (error) {
      console.error(error);
      this.orderClient.emit('orders.cancelled', order.id);
      this.notificationClient.emit('notification.ordercancelled', order);
    }
  }

  @EventPattern('orchestration.orders.approved_by_employee')
  async approvedByEmployee(order: any) {
    /* 
    {
      order_id: order.id,
      order_details: order.order_details.map((order_detail) => ({
        product_id: order_detail.product_id,
        quantity: order_detail.quantity,
      })),
      branch_id: order.branch_id,
    }
    */
    console.log('orchestration.orders.approved_by_employee', order);
    try {
      this.batchClient
        .emit('batches.approved_by_employee', {
          order_id: order.id,
          order_details: order.order_details,
          branch_id: order.branch_id,
        })
        .pipe(timeout(60000));
    } catch (error) {
      console.error(error);
    }
  }
}
