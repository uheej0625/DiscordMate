import wav from 'wav';

export default async function saveWaveFile(
   filename,
   pcmData,
   channels = 1,
   rate = 24000,
   sampleWidth = 2,
) {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on('finish', resolve);
    writer.on('error', reject);

    writer.write(pcmData);
    writer.end();
  });
}