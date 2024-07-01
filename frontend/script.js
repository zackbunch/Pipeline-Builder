document.addEventListener('DOMContentLoaded', (event) => {
  const elements = {
      blocks: document.querySelectorAll('.block'),
      dropzone: document.getElementById('pipeline-dropzone'),
      yamlOutput: document.getElementById('yaml-output'),
      modal: document.getElementById('blockModal'),
      modalClose: document.querySelector('.close'),
      blockNameInput: document.getElementById('block-name'),
      blockScriptInput: document.getElementById('block-script'),
      blockImageInput: document.getElementById('block-image'),
      blockTagsInput: document.getElementById('block-tags'),
      blockArtifactsInput: document.getElementById('block-artifacts'),
      blockWhenInput: document.getElementById('block-when'),
      blockOnlyInput: document.getElementById('block-only'),
      blockNeedsInput: document.getElementById('block-needs'),
      blockVariablesInput: document.getElementById('block-variables'),
      saveBlockButton: document.getElementById('save-block'),
      deleteBlockButton: document.getElementById('delete-block'),
      palette: document.querySelector('.palette-section .palette'),
      togglePaletteButton: document.getElementById('toggle-palette')
  };

  const gridSize = 20;
  let currentDraggedElement = null;
  let currentBlock = null;
  let lines = [];

  function addBlockEventListeners(block) {
      block.addEventListener('dragstart', handleDragStart);
      block.addEventListener('click', (e) => {
          e.stopPropagation();
          openModal(block);
      });
  }

  function handleDragStart(e) {
      e.dataTransfer.setData('text/plain', e.target.dataset.type);
      currentDraggedElement = e.target;
  }

  function handleDragOver(e) {
      e.preventDefault();
      e.target.classList.add('dragover');
  }

  function handleDragLeave(e) {
      e.target.classList.remove('dragover');
  }

  function handleDrop(e) {
      e.preventDefault();
      e.target.classList.remove('dragover');
      const blockType = e.dataTransfer.getData('text/plain');
      let newBlock;

      const targetColumn = e.target.closest('.syac-column, .dropzone');
      if (!targetColumn) return;

      if (currentDraggedElement && currentDraggedElement.parentNode === targetColumn) {
          newBlock = currentDraggedElement;
      } else {
          newBlock = createNewBlock(blockType);
          targetColumn.appendChild(newBlock);
      }

      setBlockPosition(newBlock, e.clientX, e.clientY, targetColumn);
      addBlockEventListeners(newBlock);

      if (blockType === 'syac-multi') {
          transformDropzoneForSYACMulti();
          updatePaletteForSYAC();
      }

      updateYamlOutput();
  }

  function createNewBlock(blockType) {
      const newBlock = document.createElement('div');
      newBlock.classList.add('block', 'draggable', blockType);
      newBlock.setAttribute('draggable', true);
      newBlock.dataset.type = blockType;
      newBlock.dataset.name = `${blockType}-job`;
      newBlock.dataset.script = 'echo "Example script"';
      newBlock.dataset.image = 'node:14';
      newBlock.dataset.tags = 'docker';
      newBlock.dataset.artifacts = 'coverage/';
      newBlock.dataset.when = 'on_success';
      newBlock.dataset.only = 'master';
      newBlock.dataset.needs = '';
      newBlock.dataset.variables = '';
      newBlock.textContent = blockType.charAt(0).toUpperCase() + blockType.slice(1);

      if (blockType === 'syac') {
          addSYACSubBlocks(newBlock);
      }

      return newBlock;
  }

  function addSYACSubBlocks(block) {
      const pagesBlock = createSubBlock('pages', 'Pages');
      const complianceBlock = createSubBlock('compliance', 'Compliance');
      block.appendChild(pagesBlock);
      block.appendChild(complianceBlock);
  }

  function createSubBlock(type, text) {
      const subBlock = document.createElement('div');
      subBlock.classList.add('sub-block');
      subBlock.dataset.type = type;
      subBlock.dataset.name = `${type}-job`;
      subBlock.dataset.script = `echo "${text} script"`;
      subBlock.dataset.image = 'node:14';
      subBlock.dataset.tags = 'docker';
      subBlock.dataset.artifacts = 'coverage/';
      subBlock.dataset.when = 'on_success';
      subBlock.dataset.only = 'master';
      subBlock.dataset.needs = '';
      subBlock.dataset.variables = '';
      subBlock.textContent = text;
      subBlock.addEventListener('click', (e) => {
          e.stopPropagation();
          openModal(subBlock);
      });
      return subBlock;
  }

  function transformDropzoneForSYACMulti() {
      elements.dropzone.innerHTML = ''; // Clear existing blocks
      elements.dropzone.classList.add('syac-multi'); // Add a class for special styling

      const column1 = document.createElement('div');
      column1.classList.add('syac-column');
      const column2 = document.createElement('div');
      column2.classList.add('syac-column');

      for (let i = 0; i < 5; i++) {
          const cell1 = document.createElement('div');
          cell1.classList.add('syac-cell');
          cell1.dataset.index = i;
          cell1.addEventListener('dragover', handleDragOver);
          cell1.addEventListener('dragleave', handleDragLeave);
          cell1.addEventListener('drop', handleDrop);
          column1.appendChild(cell1);

          const cell2 = document.createElement('div');
          cell2.classList.add('syac-cell');
          cell2.dataset.index = i;
          cell2.addEventListener('dragover', handleDragOver);
          cell2.addEventListener('dragleave', handleDragLeave);
          cell2.addEventListener('drop', handleDrop);
          column2.appendChild(cell2);
      }

      elements.dropzone.appendChild(column1);
      elements.dropzone.appendChild(column2);
  }

  function updatePaletteForSYAC() {
      elements.palette.innerHTML = `
      <h3>SYAC Specific</h3>
      <div class="block syac-build" draggable="true" data-type="syac-build" title="SYAC Build: SYAC specific build job">SYAC Build</div>
      <div class="block syac-test" draggable="true" data-type="syac-test" title="SYAC Test: SYAC specific test job">SYAC Test</div>
      <div class="block syac-deploy" draggable="true" data-type="syac-deploy" title="SYAC Deploy: SYAC specific deploy job">SYAC Deploy</div>
      <div class="block syac-scan" draggable="true" data-type="syac-scan" title="SYAC Scan: SYAC specific scan job">SYAC Scan</div>
      <div class="block syac-release" draggable="true" data-type="syac-release" title="SYAC Release: SYAC specific release job">SYAC Release</div>
    `;
      const newBlocks = elements.palette.querySelectorAll('.block');
      newBlocks.forEach(block => {
          addBlockEventListeners(block);
      });
  }

  function setBlockPosition(block, clientX, clientY, targetColumn) {
      const offsetX = snapToGrid(clientX - targetColumn.getBoundingClientRect().left - block.offsetWidth / 2);
      const offsetY = snapToGrid(clientY - targetColumn.getBoundingClientRect().top - block.offsetHeight / 2);
      block.style.left = `${offsetX}px`;
      block.style.top = `${offsetY}px`;
  }

  function snapToGrid(value) {
      return Math.round(value / gridSize) * gridSize;
  }

  function snapBlocksTogether() {
      const columns = elements.dropzone.querySelectorAll('.syac-column, .dropzone');

      columns.forEach(column => {
          const blocks = Array.from(column.querySelectorAll('.block')).sort((a, b) => {
              return parseInt(a.style.top) - parseInt(b.style.top);
          });

          blocks.forEach((block, index) => {
              block.style.top = `${index * (gridSize * 3)}px`;
              block.style.left = `0px`;
          });
      });
  }

  function updateYamlOutput() {
    const blocks = Array.from(elements.dropzone.querySelectorAll('.block')).map((block, index) => ({
        id: `block-${index}`,
        type: block.dataset.type,
        name: block.dataset.name,
        data: { label: block.textContent },
        position: {
            x: parseInt(block.style.left, 10),
            y: parseInt(block.style.top, 10),
        },
        script: block.dataset.script || `echo ${block.textContent}`,
        image: block.dataset.image,
        tags: block.dataset.tags ? block.dataset.tags.split(',') : [],
        artifacts: block.dataset.artifacts ? block.dataset.artifacts.split(',') : [],
        when: block.dataset.when,
        only: block.dataset.only ? block.dataset.only.split(',') : [],
        needs: block.dataset.needs ? block.dataset.needs.split(',') : [],
        variables: block.dataset.variables ? block.dataset.variables.split(',') : []
    }));

    blocks.sort((a, b) => a.position.y - b.position.y);

    const stages = [];
    const jobs = {};

    blocks.forEach(block => {
        if (!stages.includes(block.type)) {
            stages.push(block.type);
        }
        jobs[block.name] = {
            stage: block.type,
            script: block.script.split('\n'),
            image: block.image,
            tags: block.tags,
            artifacts: {
                paths: block.artifacts
            },
            when: block.when,
            only: block.only,
            needs: block.needs,
            variables: block.variables
        };

        if (block.querySelector) {
            const subBlocks = Array.from(block.querySelectorAll('.sub-block'));
            if (subBlocks.length > 0) {
                subBlocks.forEach(subBlock => {
                    jobs[subBlock.dataset.name] = {
                        stage: block.dataset.type,
                        script: subBlock.dataset.script.split('\n'),
                        image: subBlock.dataset.image,
                        tags: subBlock.dataset.tags,
                        artifacts: {
                            paths: subBlock.dataset.artifacts
                        },
                        when: subBlock.dataset.when,
                        only: subBlock.dataset.only,
                        needs: subBlock.dataset.needs,
                        variables: subBlock.dataset.variables
                    };
                });
            }
        }
    });

    const yamlData = { stages, jobs };
    elements.yamlOutput.textContent = jsyaml.dump(yamlData);
    hljs.highlightBlock(elements.yamlOutput);
}

function openModal(block) {
    console.log('Opening modal for block:', block.dataset);
    currentBlock = block;
    elements.blockNameInput.value = block.dataset.name || '';
    elements.blockScriptInput.value = block.dataset.script || `echo ${block.textContent}`;
    elements.blockImageInput.value = block.dataset.image || '';
    elements.blockTagsInput.value = block.dataset.tags || '';
    elements.blockArtifactsInput.value = block.dataset.artifacts || '';
    elements.blockWhenInput.value = block.dataset.when || 'on_success';
    elements.blockOnlyInput.value = block.dataset.only || '';
    elements.blockVariablesInput.value = block.dataset.variables || '';
    elements.blockNeedsInput.innerHTML = '';

    const existingNeeds = block.dataset.needs ? block.dataset.needs.split(',') : [];
    Array.from(elements.dropzone.querySelectorAll('.block')).forEach(b => {
        if (b !== block) {
            const option = document.createElement('option');
            option.value = b.dataset.name;
            option.textContent = b.dataset.name;
            if (existingNeeds.includes(option.value)) {
                option.selected = true;
            }
            elements.blockNeedsInput.appendChild(option);
        }
    });
    elements.modal.style.display = "block";
}

function handleModalClose() {
    elements.modal.style.display = "none";
}

function handleSaveBlock() {
    console.log('Saving block:', currentBlock);
    if (currentBlock) {
        currentBlock.dataset.name = elements.blockNameInput.value;
        currentBlock.dataset.script = elements.blockScriptInput.value;
        currentBlock.dataset.image = elements.blockImageInput.value;
        currentBlock.dataset.tags = elements.blockTagsInput.value;
        currentBlock.dataset.artifacts = elements.blockArtifactsInput.value;
        currentBlock.dataset.when = elements.blockWhenInput.value;
        currentBlock.dataset.only = elements.blockOnlyInput.value;
        currentBlock.dataset.needs = Array.from(elements.blockNeedsInput.selectedOptions).map(option => option.value).join(',');
        currentBlock.dataset.variables = elements.blockVariablesInput.value;
        updateYamlOutput();
    }
    handleModalClose();
}

function handleDeleteBlock() {
    console.log('Deleting block:', currentBlock);
    if (currentBlock) {
        currentBlock.remove();
        updateYamlOutput();
    }
    handleModalClose();
}

function handleWindowClick(event) {
    if (event.target == elements.modal) {
        handleModalClose();
    }
}

function updateConnections() {
    // Clear existing lines
    lines.forEach(line => line.remove());
    lines = [];

    const blocks = elements.dropzone.querySelectorAll('.block');

    blocks.forEach(block => {
        const needs = block.dataset.needs ? block.dataset.needs.split(',') : [];
        needs.forEach(need => {
            const targetBlock = [...blocks].find(b => b.dataset.name === need);
            if (targetBlock) {
                lines.push(new LeaderLine(block, targetBlock));
            }
        });
    });
}

function initializeEventListeners() {
    elements.blocks.forEach(block => {
        addBlockEventListeners(block);
    });

    elements.dropzone.addEventListener('dragover', handleDragOver);
    elements.dropzone.addEventListener('drop', handleDrop);

    elements.modalClose.addEventListener('click', handleModalClose);
    elements.saveBlockButton.addEventListener('click', handleSaveBlock);
    elements.deleteBlockButton.addEventListener('click', handleDeleteBlock);
    window.addEventListener('click', handleWindowClick);

    const observer = new MutationObserver(updateYamlOutput);
    observer.observe(elements.dropzone, { childList: true, subtree: true });
}

document.getElementById('save-config').addEventListener('click', () => {
    const config = elements.dropzone.innerHTML;
    localStorage.setItem('pipelineConfig', config);
});

document.getElementById('load-config').addEventListener('click', () => {
    const config = localStorage.getItem('pipelineConfig');
    if (config) {
        elements.dropzone.innerHTML = config;
        // Reinitialize event listeners for the loaded elements
        const loadedBlocks = elements.dropzone.querySelectorAll('.block');
        loadedBlocks.forEach(block => {
            addBlockEventListeners(block);
        });
        updateYamlOutput();
    }
});

document.getElementById('toggle-palette').addEventListener('click', () => {
    if (elements.togglePaletteButton.textContent === 'Toggle Palette') {
        elements.togglePaletteButton.textContent = 'SYAC Multi';
        transformDropzoneForSYACMulti();
        updatePaletteForSYAC();
    } else {
        elements.togglePaletteButton.textContent = 'Toggle Palette';
        loadPredefinedPalette();
    }
});

function loadPredefinedPalette() {
    elements.palette.innerHTML = `
      <h3>Pre-defined</h3>
      <div class="block build" draggable="true" data-type="build" title="Build: Compiles your code">Build</div>
      <div class="block test" draggable="true" data-type="test" title="Test: Runs automated tests">Test</div>
      <div class="block release" draggable="true" data-type="release" title="Release: Prepares a release">Release</div>
      <div class="block deploy" draggable="true" data-type="deploy" title="Deploy: Deploys the application">Deploy</div>
      <div class="block webhook" draggable="true" data-type="webhook" title="Webhook: Triggers a webhook">Webhook</div>
      <div class="block scan" draggable="true" data-type="scan" title="Scan: Scans the code for vulnerabilities">Scan</div>
      <div class="block syac" draggable="true" data-type="syac" title="SYAC: Special job for compliance">SYAC</div>
      <div class="block syac-multi" draggable="true" data-type="syac-multi" title="SYAC Multi: Multiple SYAC jobs">SYAC Multi</div>
    `;
    const newBlocks = elements.palette.querySelectorAll('.block');
    newBlocks.forEach(block => {
        addBlockEventListeners(block);
    });

    // Restore the original dropzone
    elements.dropzone.innerHTML = '';
    elements.dropzone.classList.remove('syac-multi');
    elements.dropzone.appendChild(document.createElement('div')); // Ensure it has a child to work with
}

// Call initialize function to set up event listeners and any necessary initial state
initializeEventListeners();
});