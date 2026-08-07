const url = "https://bwhhfzhrjtvkrrsdxfbh.supabase.co/functions/v1/create-partner-admin";

async function run() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'testpassword',
      full_name: 'Test Name',
      lot_id: '00000000-0000-0000-0000-000000000000',
      role: 'manager',
      application_id: 1
    })
  });
  
  const text = await res.text();
  console.log(`STATUS: ${res.status}`);
  console.log(`BODY: ${text}`);
}

run();
