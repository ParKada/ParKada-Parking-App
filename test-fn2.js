const url = "https://bwhhfzhrjtvkrrsdxfbh.supabase.co/functions/v1/create-partner-admin";

async function run() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'testnull@example.com',
      password: 'testpassword',
      full_name: 'Test Null Name',
      lot_id: null,
      role: 'manager',
      application_id: null
    })
  });
  
  const text = await res.text();
  console.log(`STATUS: ${res.status}`);
  console.log(`BODY: ${text}`);
}

run();
