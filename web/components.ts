// Entity Values
const entityData = new Map();
function onEntityDataChange(path?: string) {
  if (typeof path === 'string' && entityData.has(path)) {
    console.log(`${path} is set to ${entityData.get(path)}`);
    return;
  }
  console.log(entityData);
}

// Main script
(function () {
  // Event listener
  window.addEventListener('message', (event) => {
    const message = event.data;
    switch (message.cmd) {
      case 'add_component':
        break;
      case 'set_entity_info':
        setEntityInfo(message.host, message.entityId);
        break;
      case 'update':
        update(message.data);
        break;
    }
  });

  function setEntityInfo(host: string, entityId: number) {
    const hostLabel = document.querySelector('#entity-info-host');
    if (hostLabel instanceof Element) {
      hostLabel.textContent = host;
    }

    const idLabel = document.querySelector('#entity-info-id');
    if (idLabel instanceof Element) {
      idLabel.textContent = entityId.toString();
    }
  }

  function update(_data) {
    console.log('tried to update');
  }

  onEntityDataChange();
})();
