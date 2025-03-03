//@ts-check

// TODO: import somehow (maybe using importmap)
// import '@vscode-elements/elements/dist/vscode-tree/index.js';

(function () {
  const vscode = acquireVsCodeApi();

  console.log('SCRIPT IS WORKING THOUGH');

  document.querySelector('.view-info-button')?.addEventListener('click', () => {
    doNothing();
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.type) {
      case 'update':
        if (message.focus === null) {
          clear();
        } else {
          clear();
          outputEntityInfo(message.focus);
        }
    }
  });

  function clear() {
    const element = document.querySelector('.entity-info');
    if (element === null) return;
    element.remove();
  }

  function outputEntityInfo(focus) {
    const dev = document.createElement('a');
    dev.className = 'entity-info';
    dev.textContent = focus.host + focus.id;
    document.body.appendChild(dev);
  }

  function doNothing() {
    vscode.postMessage({ type: 'doNothing', log: 'DO SOMETHING' });
  }

  const tree = document.querySelector('#tree-basic-example');
  const icons = {
    branch: 'folder',
    leaf: 'file',
    open: 'folder-opened',
  };
  const data = [
    {
      icons,
      label: 'node_modules',
      value: 'black hole',
      subItems: [
        {
          icons,
          label: '.bin',
          subItems: [
            { icons, label: '_mocha_' },
            { icons, label: '_mocha.cmd_' },
            { icons, label: '_mocha.ps1_' },
            { icons, label: 'acorn' },
            { icons, label: 'acorn.cmd' },
            { icons, label: 'acorn.ps1' },
          ],
        },
        {
          icons,
          label: '@11ty',
          open: true,
          subItems: [
            { icons, label: 'lorem.js' },
            { icons, label: 'ipsum.js' },
            { icons, label: 'dolor.js' },
          ],
        },
        { icons, label: '.DS_Store' },
      ],
    },
    {
      icons,
      label: 'scripts',
      subItems: [
        { icons, label: 'build.js' },
        { icons, label: 'start.js' },
      ],
    },
    { icons, label: '.editorconfig', selected: true },
    { icons, label: '2021-01-18T22_10_20_535Z-debug.log' },
  ];
  if (tree !== null) {
    // @ts-ignore
    tree.data = data;
    console.log('data was placed');
  } else {
    console.log('data IS NOT placed');
  }
})();
