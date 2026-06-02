const apiKey = "AIzaSyCwO4cSeKqL0gdSALDfqPcGRx5tw8onQpk";
const email = "napolitanoeapc@gmail.com";
const password = "napolitanomaisfoda";

async function getAuthToken() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await res.json();
  if (data.idToken) return data.idToken;
  console.log("Auth failed:", data.error?.message);
  return null;
}

async function run() {
  console.log("Autenticando...");
  const token = await getAuthToken();
  if (!token) return;
  console.log("Autenticado! Buscando pedidos...");

  const dbUrl = `https://interclasse-250b0-default-rtdb.firebaseio.com/orders.json?auth=${token}`;
  const res = await fetch(dbUrl);
  const orders = await res.json();

  if (!orders || orders.error) {
    console.log("Falha ao buscar banco:", orders?.error);
    return;
  }

  console.log("Total de pedidos:", Object.keys(orders).length);

  // Find the order IC-2025-0R0E
  let foundKey = null;
  let foundOrder = null;
  for (const key in orders) {
    if (orders[key].codigo === 'IC-2025-0R0E') {
      foundKey = key;
      foundOrder = orders[key];
      break;
    }
  }

  if (!foundOrder) {
    console.log("Pedido IC-2025-0R0E não encontrado. Listando todos:");
    for (const key in orders) {
      console.log(`${orders[key].codigo} | ${orders[key].compradorNome || orders[key].nome}`);
    }
    return;
  }

  console.log("\nPedido encontrado:");
  console.log(JSON.stringify(foundOrder, null, 2));

  // Show current numero values
  console.log("\nNúmero atual (campo raiz):", foundOrder.numero);
  if (foundOrder.camisas) {
    foundOrder.camisas.forEach((c, i) => {
      console.log(`Camisa ${i}: numero=${c.numero}`);
    });
  }

  // Build update payload: change "02" -> "2" wherever found
  const updates = {};

  if (foundOrder.numero === '02' || foundOrder.numero === 2) {
    updates.numero = '2';
  }

  const newCamisas = foundOrder.camisas ? foundOrder.camisas.map(c => ({
    ...c,
    numero: (c.numero === '02' || c.numero === 2) ? '2' : c.numero
  })) : undefined;

  if (newCamisas) updates.camisas = newCamisas;

  if (Object.keys(updates).length === 0) {
    console.log("\nNenhum campo '02' encontrado para mudar.");
    return;
  }

  console.log("\nAplicando update:", JSON.stringify(updates, null, 2));

  const patchRes = await fetch(
    `https://interclasse-250b0-default-rtdb.firebaseio.com/orders/${foundKey}.json?auth=${token}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }
  );
  const patchData = await patchRes.json();
  console.log("\nResultado do update:", JSON.stringify(patchData, null, 2));
  console.log("\n✅ Número da camisa atualizado de '02' para '2' com sucesso!");
}

run();
