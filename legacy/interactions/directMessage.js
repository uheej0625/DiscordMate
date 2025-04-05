// import generateMessage from "../chat/directMessage.js";
//
// let messageBuffer = []; // 메시지를 저장할 배열
// let typingUsers = []; // 타이핑 중인 유저 배열
// let typingTimeout = null; // 타이핑 중지 타이머
//
//
// async function chat(message) {
//   console.log(message.author.username + ' : ' + message.content);
//   const messageStream = generateMessage(message.content);
//   let response = '';
//   const channel = message.client.channels.cache.get(message.channelId);
//
//   for await (const chunk of messageStream) {
//     process.stdout.write(chunk); // 실시간으로 출력
//     response += chunk;
//
//     // 구두점으로 문장이 완성되면 전송
//     if (/[.,?!]/.test(chunk)) {
//       const sentences = response.split(/(?<=[.,?!])/);
//       for (let i = 0; i < sentences.length - 1; i++) {
//         let sentence = sentences[i].trim();
//         if (sentence) {
//           sentence = sentence.replace(/\.$/, ''); // 문장 끝이 마침표일 경우에만 제거
//           channel.send(sentence);
//           await new Promise(resolve => setTimeout(resolve, sentence.length * 100)); // 글자수에 비례한 딜레이
//         }
//       }
//       response = sentences[sentences.length - 1];
//     }
//   }
//
//   // 남은 문장이 있으면 전송
//   if (response.trim()) {
//     channel.send(response.trim());
//   }
// }
//
// function type(typing) {
//   const { channel, user } = typing;
//   //console.log(typing)
//   //console.log(user.username + ' is typing in ' + channel.name);
//   return typing
// }
//
// export { chat, type };