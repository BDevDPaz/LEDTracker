import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const reportsAdapter = {
  printToFile: async (html: string) => {
    return await Print.printToFileAsync({ html, base64: false });
  },

  shareFile: async (uri: string, mimeType: string) => {
    return await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType });
  }
};
