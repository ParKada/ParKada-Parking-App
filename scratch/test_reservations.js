const url = 'https://bwhhfzhrjtvkrrsdxfbh.supabase.co/rest/v1/reservations?select=*,parking_slots(slot_number,parking_lots(id,name,address))';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3aGhmemhyanR2a3Jyc2R4ZmJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MDc3NTIsImV4cCI6MjA5NjI4Mzc1Mn0.Iy0QbQe6eeU9y3xx_L6qCqLUFfoH9PQhq82gDtUjYPw';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(res => res.json())
.then(data => {
  if (data.error || data.code) {
    console.error('Supabase Error:', data);
  } else {
    console.log('Reservations Count:', data.length);
  }
})
.catch(err => console.error(err));
