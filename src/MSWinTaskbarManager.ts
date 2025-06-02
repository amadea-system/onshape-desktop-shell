import { app } from 'electron';
import { isDev } from './util';

/**
 * Sets up the Windows Taskbar Jump List for the application.
 */
export function setupTaskbar() {
  if (process.platform !== 'win32') {
    console.log('Skipping Taskbar Setup. Only supported on Windows.');
    return;
  }
  
  // let arguments_array = process.argv.slice(1);
  // // Check if the app is packed
  // if (!app.isPackaged) {
  //   // If not packed, use the development mode arguments
  //   arguments = '--new-window';
  // }

  // Set up the taskbar jump list
  app.setUserTasks([
    {
      program: process.execPath,
      arguments: '--new-window',
      iconPath: process.execPath,
      iconIndex: 0,
      title: 'New Window',
      description: 'Create a new window'
    },
    /*{
      program: process.execPath,
      arguments: '--open-url https://example.com',
      iconPath: process.execPath,
      iconIndex: 0,
      title: 'Open URL',
      description: 'Open a specific URL'
    }*/
  ]);
  console.log('Taskbar setup completed.');
  // console.log('Taskbar setup arguments:', arguments_array.join(' ') + ' --open-url https://example.com');
  // console.log('Taskbar setup is skipped in development mode.');
}



