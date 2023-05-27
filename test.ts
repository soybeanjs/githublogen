import { $fetch } from 'ohmyfetch';

const email = 'honghuangdc@gmail.com';

async function test() {
  const data = await $fetch(`https://ungh.cc/users/find/${email}`);
  console.log('data: ', data);
}

test();
