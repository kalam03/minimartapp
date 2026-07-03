import EscPosEncoder from 'esc-pos-encoder';

export class PrintService {

  generateReceipt(cart: any[], total: number, invoiceNo: string) {

    const encoder = new EscPosEncoder();

    const result = encoder
      .initialize()
      .align('center')
      .text('Lucky Shop')
      .newline()
      .text('Invoice: ' + invoiceNo)
      .newline()
      .align('left')
      .newline();

    cart.forEach(item => {
      result.text(`${item.name} x${item.qty} = ${item.price * item.qty}`).newline();
    });

    result
      .newline()
      .text('----------------------')
      .text('TOTAL: ' + total)
      .newline()
      .align('center')
      .text('Thank You!')
      .cut();

    return result.encode();
  }
}