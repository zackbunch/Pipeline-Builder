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
    saveBlockButton: document.getElementById('save-block'),
    exportYamlButton: document.getElementById('export-yaml'),
    importYamlInput: document.getElementById('import-yaml')
  };

  const gridSize = 20;
  let currentDraggedElement = null;
  let shiftX, shiftY;
  let currentBlock = null;

  function addBlockEventListeners(block) {
    block.addEventListener('dragstart', handleDragStart);
    block.addEventListener('click', () => openModal(block));
  }

  function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.type);
    currentDraggedElement = e.target;
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();
    const blockType = e.dataTransfer.getData('text/plain');
    let newBlock;

    if (currentDraggedElement && elements.dropzone.contains(currentDraggedElement)) {
      newBlock = currentDraggedElement;
    } else {
      newBlock = createNewBlock(blockType);
      elements.dropzone.appendChild(newBlock);
    }

    setBlockPosition(newBlock, e.clientX, e.clientY);
    addBlockEventListeners(newBlock);
    snapBlocksTogether();
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
    newBlock.textContent = blockType.charAt(0).toUpperCase() + blockType.slice(1);

    if (blockType === 'sast') {
      addComplianceJob(newBlock, 'klocwork-job', 'run klocwork analysis');
      addComplianceJob(newBlock, 'sonarqube-job', 'run sonarqube analysis');
    }

    return newBlock;
  }

  function setBlockPosition(block, clientX, clientY) {
    const offsetX = snapToGrid(clientX - elements.dropzone.getBoundingClientRect().left - block.offsetWidth / 2);
    const offsetY = snapToGrid(clientY - elements.dropzone.getBoundingClientRect().top - block.offsetHeight / 2);
    block.style.left = `${offsetX}px`;
    block.style.top = `${offsetY}px`;
  }

  function snapToGrid(value) {
    return Math.round(value / gridSize) * gridSize;
  }

  function snapBlocksTogether() {
    const blocks = Array.from(elements.dropzone.querySelectorAll('.block')).sort((a, b) => {
      return parseInt(a.style.top) - parseInt(b.style.top);
    });

    blocks.forEach((block, index) => {
      block.style.top = `${index * (gridSize * 3)}px`;
      block.style.left = `0px`;
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
      needs: block.dataset.needs ? block.dataset.needs.split(',') : []
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
        script: block.script,
        image: block.image,
        tags: block.tags,
        artifacts: {
          paths: block.artifacts
        },
        when: block.when,
        only: block.only,
        needs: block.needs
      };
    });

    const yamlData = { stages, jobs };
    elements.yamlOutput.textContent = jsyaml.dump(yamlData);
    hljs.highlightBlock(elements.yamlOutput);
  }

  function openModal(block) {
    currentBlock = block;
    elements.blockNameInput.value = block.dataset.name || '';
    elements.blockScriptInput.value = block.dataset.script || `echo ${block.textContent}`;
    elements.blockImageInput.value = block.dataset.image || '';
    elements.blockTagsInput.value = block.dataset.tags || '';
    elements.blockArtifactsInput.value = block.dataset.artifacts || '';
    elements.blockWhenInput.value = block.dataset.when || 'on_success';
    elements.blockOnlyInput.value = block.dataset.only || '';
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

  function addComplianceJob(parentBlock, jobName, script) {
    const newJob = document.createElement('div');
    newJob.classList.add('block', 'draggable', 'compliance');
    newJob.setAttribute('draggable', true);
    newJob.dataset.type = 'compliance';
    newJob.dataset.name = jobName;
    newJob.dataset.script = script;
    newJob.dataset.image = '';
    newJob.dataset.tags = '';
    newJob.dataset.artifacts = '';
    newJob.dataset.when = 'on_success';
    newJob.dataset.only = '';
    newJob.dataset.needs = parentBlock.dataset.name;
    newJob.textContent = jobName;
    newJob.style.left = '0px';
    newJob.style.top = '0px';
    elements.dropzone.appendChild(newJob);
  }

  function handleModalClose() {
    elements.modal.style.display = "none";
  }

  function handleSaveBlock() {
    if (currentBlock) {
      currentBlock.dataset.name = elements.blockNameInput.value;
      currentBlock.dataset.script = elements.blockScriptInput.value;
      currentBlock.dataset.image = elements.blockImageInput.value;
      currentBlock.dataset.tags = elements.blockTagsInput.value;
      currentBlock.dataset.artifacts = elements.blockArtifactsInput.value;
      currentBlock.dataset.when = elements.blockWhenInput.value;
      currentBlock.dataset.only = elements.blockOnlyInput.value;
      currentBlock.dataset.needs = Array.from(elements.blockNeedsInput.selectedOptions).map(option => option.value).join(',');
      updateYamlOutput();
    }
    handleModalClose();
  }

  function handleWindowClick(event) {
    if (event.target == elements.modal) {
      handleModalClose();
    }
  }

  function handleExportYaml() {
    const yamlContent = elements.yamlOutput.textContent;
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pipeline.yml';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportYaml(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const yamlContent = e.target.result;
        try {
          const yamlData = jsyaml.load(yamlContent);
          loadYamlData(yamlData);
        } catch (error) {
          alert('Invalid YAML file');
        }
      };
      reader.readAsText(file);
    }
  }

  function loadYaml(yamlData) {
    elements.dropzone.innerHTML = ''; // Clear existing blocks
    const stages = yamlData.stages || [];
    const jobs = yamlData.jobs || {};

    stages.forEach((stage, index) => {
        const stageBlocks = Object.keys(jobs).filter(jobName => jobs[jobName].stage === stage);
        stageBlocks.forEach(jobName => {
            const jobData = jobs[jobName];
            const newBlock = createNewBlockFromYaml(jobData, stage, index);
            elements.dropzone.appendChild(newBlock);
        });
    });

    snapBlocksTogether();
    updateYamlOutput();
}

function createNewBlockFromYaml(jobData, stage, index) {
    const newBlock = document.createElement('div');
    newBlock.classList.add('block', 'draggable', stage);
    newBlock.setAttribute('draggable', true);
    newBlock.dataset.type = stage;
    newBlock.dataset.name = jobData.name;
    newBlock.dataset.script = jobData.script.join('\n');
    newBlock.dataset.image = jobData.image || '';
    newBlock.dataset.tags = jobData.tags ? jobData.tags.join(',') : '';
    newBlock.dataset.artifacts = jobData.artifacts ? jobData.artifacts.paths.join(',') : '';
    newBlock.dataset.when = jobData.when || 'on_success';
    newBlock.dataset.only = jobData.only ? jobData.only.join(',') : '';
    newBlock.dataset.needs = jobData.needs ? jobData.needs.join(',') : '';
    newBlock.textContent = stage.charAt(0).toUpperCase() + stage.slice(1);
    newBlock.style.left = `${0}px`;
    newBlock.style.top = `${index * 100}px`; // Adjust vertical spacing as needed

    addBlockEventListeners(newBlock);
    return newBlock;
}

// Initialize event listeners for the page elements
function initializeEventListeners() {
    elements.blocks.forEach(block => {
        addBlockEventListeners(block);
    });

    elements.dropzone.addEventListener('dragover', handleDragOver);
    elements.dropzone.addEventListener('drop', handleDrop);

    elements.modalClose.addEventListener('click', handleModalClose);
    elements.saveBlockButton.addEventListener('click', handleSaveBlock);
    window.addEventListener('click', handleWindowClick);

    elements.exportYamlButton.addEventListener('click', handleExportYaml);
    elements.importYamlInput.addEventListener('change', handleImportYaml);

    const observer = new MutationObserver(updateYamlOutput);
    observer.observe(elements.dropzone, { childList: true, subtree: true });
}

// Call initialize function to set up event listeners and any necessary initial state
initializeEventListeners();
});