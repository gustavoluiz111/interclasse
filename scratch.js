const res = await fetch('https://interclasse-250b0-default-rtdb.firebaseio.com/orders.json');
const orders = await res.json();
console.log("Total orders:", orders ? Object.keys(orders).length : 0);
let count = 0;
for (const key in orders) {
  const o = orders[key];
  if(count < 2) {
    console.log("Sample order:", JSON.stringify(o, null, 2));
    count++;
  }
}
