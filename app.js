const STORAGE_KEY = "muebleria-produccion-demo-v5";
const SESSION_KEY = "muebleria-produccion-session-v1";
const AUTH_CODE_KEY = "muebleria-profile-code-v1";
const NOTIFICATION_READ_KEY = "muebleria-notification-reads-v1";
const CALENDAR_ARCHIVE_KEY = "muebleria-calendar-show-archived-v1";
const COLLAPSED_TEMPLATES_KEY = "muebleria-collapsed-templates-v1";
const COLLAPSED_ADMIN_SECTIONS_KEY = "muebleria-collapsed-admin-sections-v1";

const defaultAreas = ["Diseno", "Cascos", "Chapa", "Barniz", "Tapiz", "Montaje", "Corte CNC", "Armado", "Lijado", "Acabado", "Tapizado", "Entrega", "Herreria"];

const seedData = {
  areas: defaultAreas,
  notifications: [],
  products: [
    {
      id: "prod-recamara-polar",
      name: "Recamara Polar",
      templateId: "tpl-estandar",
      materials: [
        materialRow(5, "hojas", "MDF 18mm"),
        materialRow(6, "pares", "Correderas"),
        materialRow(12, "piezas", "Bisagras"),
        materialRow(1, "kit", "Herrajes de armado")
      ],
      areaMinutes: { "Diseno": 360, "Corte CNC": 480, "Armado": 960, "Lijado": 480, "Acabado": 960, "Tapizado": 360, "Entrega": 180 }
    },
    {
      id: "prod-comedor-edimburgo",
      name: "Comedor Edimburgo",
      templateId: "tpl-cascos-rama",
      materials: [
        materialRow(1, "lote", "Madera base"),
        materialRow(8, "m2", "Chapa natural"),
        materialRow(4, "L", "Barniz"),
        materialRow(6, "m", "Tela")
      ],
      areaMinutes: { "Diseno": 240, "Cascos": 720, "Chapa": 600, "Barniz": 720, "Tapiz": 480, "Montaje": 360, "Entrega": 180 }
    }
  ],
  users: [
    { id: "u-diseno", name: "Francisco", area: "Diseno", role: "admin", code: "48271", isPrimaryAdmin: true },
    { id: "u-cascos", name: "Jose", area: "Cascos", role: "worker", code: "73519" },
    { id: "u-chapa", name: "Luis", area: "Chapa", role: "worker", code: "29684" },
    { id: "u-barniz", name: "Marta", area: "Barniz", role: "worker", code: "84126" },
    { id: "u-tapiz", name: "Ana", area: "Tapiz", role: "worker", code: "51397" },
    { id: "u-montaje", name: "Miguel", area: "Montaje", role: "worker", code: "92743" },
    { id: "u-cnc", name: "Juan", area: "Corte CNC", role: "worker", code: "36458" },
    { id: "u-admin", name: "Administracion", area: "Administracion", role: "admin", code: "61835", isPrimaryAdmin: true }
  ],
  templates: [
    linearTemplate("tpl-estandar", "Estandar", ["Diseno", "Corte CNC", "Armado", "Lijado", "Acabado", "Tapizado", "Entrega"]),
    linearTemplate("tpl-sin-tapizado", "Sin tapizado", ["Diseno", "Corte CNC", "Armado", "Lijado", "Acabado", "Entrega"]),
    linearTemplate("tpl-especial", "Especial", ["Diseno", "Herreria", "Corte CNC", "Armado", "Acabado", "Entrega"]),
    {
      id: "tpl-cascos-rama",
      name: "Cascos con Chapa y Tapiz",
      nodes: [
        { id: "n-diseno", area: "Diseno", nextIds: ["n-cascos"] },
        { id: "n-cascos", area: "Cascos", nextIds: ["n-chapa", "n-tapiz"] },
        { id: "n-chapa", area: "Chapa", nextIds: ["n-barniz"] },
        { id: "n-barniz", area: "Barniz", nextIds: ["n-montaje"] },
        { id: "n-tapiz", area: "Tapiz", nextIds: ["n-montaje"] },
        { id: "n-montaje", area: "Montaje", nextIds: ["n-entrega"] },
        { id: "n-entrega", area: "Entrega", nextIds: [] }
      ]
    }
  ],
  projects: [
    graphProject("p-3", "Comedor Edimburgo", "tpl-cascos-rama", ["n-cascos"], [
      history("n-diseno", "Diseno", "Francisco", "2026-06-22T11:15:00")
    ], "2026-06-24T10:45:00"),
    graphProject("p-1", "Recamara Polar", "tpl-estandar", ["tpl-estandar-1"], [
      history("tpl-estandar-0", "Diseno", "Francisco", "2026-06-24T15:32:00")
    ], "2026-06-24T17:32:00"),
    graphProject("p-2", "Sala Dubai", "tpl-estandar", ["tpl-estandar-4"], [
      history("tpl-estandar-0", "Diseno", "Francisco", "2026-06-20T09:22:00"),
      history("tpl-estandar-1", "Corte CNC", "Juan", "2026-06-21T16:10:00"),
      history("tpl-estandar-2", "Armado", "Miguel", "2026-06-23T13:40:00"),
      history("tpl-estandar-3", "Lijado", "Rosa", "2026-06-23T18:05:00")
    ], "2026-06-23T20:05:00")
  ]
};

let state = migrateState(loadState());
localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
let confirmedState = structuredClone(state);
let currentUser = null;
let canModifySharedState = false;
let activeAdminTab = "admin";
let editingTemplateId = null;
let editingNodes = [];
let editingProductId = null;
let editingProductMaterials = [];
let editingProductTimes = [];
let editingProductDocuments = [];
let calendarMonthDate = new Date();
let showArchivedInCalendar = localStorage.getItem(CALENDAR_ARCHIVE_KEY) === "true";
const expandedCalendarWeeks = new Set();
const collapsedTemplates = new Set(parseStoredArray(COLLAPSED_TEMPLATES_KEY));
const collapsedAdminSections = new Set(parseStoredArray(COLLAPSED_ADMIN_SECTIONS_KEY));
let returnRequest = null;
let blockRequest = null;
let reopenProjectId = null;
let editingUserId = null;
let editingProjectId = null;
let pendingProjectDraft = null;
let developerMode = false;
const archiveSelection = new Set();
let archiveVisibleKeys = [];
const adminProjectSelection = new Set();
let adminVisibleProjectIds = [];
let adminVisibleCompletedIds = [];
const areaSelection = new Set();

const loginView = document.querySelector("#loginView");
const developerView = document.querySelector("#developerView");
const workspaceView = document.querySelector("#workspaceView");
const userGrid = document.querySelector("#userGrid");
const accessForm = document.querySelector("#accessForm");
const accessCodeInput = document.querySelector("#accessCodeInput");
const accessError = document.querySelector("#accessError");
const currentUserName = document.querySelector("#currentUserName");
const currentUserArea = document.querySelector("#currentUserArea");
const currentAreaDot = document.querySelector("#currentAreaDot");
const navTabs = document.querySelector("#navTabs");
const operatorView = document.querySelector("#operatorView");
const adminView = document.querySelector("#adminView");
const productsView = document.querySelector("#productsView");
const calendarView = document.querySelector("#calendarView");
const archiveView = document.querySelector("#archiveView");
const operatorTitle = document.querySelector("#operatorTitle");
const pendingCount = document.querySelector("#pendingCount");
const operatorProjects = document.querySelector("#operatorProjects");
const operatorSearchInput = document.querySelector("#operatorSearchInput");
const templateSelect = document.querySelector("#templateSelect");
const projectProductSelect = document.querySelector("#projectProductSelect");
const projectProductSearchInput = document.querySelector("#projectProductSearchInput");
const projectProductSuggestions = document.querySelector("#projectProductSuggestions");
const projectProductCategorySelect = document.querySelector("#projectProductCategorySelect");
const projectProductFamilySelect = document.querySelector("#projectProductFamilySelect");
const projectProductVariantSelect = document.querySelector("#projectProductVariantSelect");
const projectProductSummary = document.querySelector("#projectProductSummary");
const projectStartDateInput = document.querySelector("#projectStartDateInput");
const projectDueDateInput = document.querySelector("#projectDueDateInput");
const projectDateError = document.querySelector("#projectDateError");
const assignOnCreateInput = document.querySelector("#assignOnCreateInput");
const templateList = document.querySelector("#templateList");
const areaList = document.querySelector("#areaList");
let areaForm = document.querySelector("#areaForm");
let areaNameInput = document.querySelector("#areaNameInput");
const adminProjects = document.querySelector("#adminProjects");
const archiveContent = document.querySelector("#archiveContent");
const projectForm = document.querySelector("#projectForm");
const projectNameInput = document.querySelector("#projectNameInput");
const projectFolioInput = document.querySelector("#projectFolioInput");
const adminSearchInput = document.querySelector("#adminSearchInput");
const selectAllProjectsButton = document.querySelector("#selectAllProjectsButton");
const selectCompletedProjectsButton = document.querySelector("#selectCompletedProjectsButton");
const archiveSelectedProjectsButton = document.querySelector("#archiveSelectedProjectsButton");
const archiveSearchInput = document.querySelector("#archiveSearchInput");
const calendarSearchInput = document.querySelector("#calendarSearchInput");
const calendarSummary = document.querySelector("#calendarSummary");
const calendarGrid = document.querySelector("#calendarGrid");
const calendarList = document.querySelector("#calendarList");
const calendarMonthLabel = document.querySelector("#calendarMonthLabel");
const calendarArchivedToggle = document.querySelector("#calendarArchivedToggle");
const historyDialog = document.querySelector("#historyDialog");
const historyTitle = document.querySelector("#historyTitle");
const historyContent = document.querySelector("#historyContent");
const projectDetailsDialog = document.querySelector("#projectDetailsDialog");
const projectDetailsTitle = document.querySelector("#projectDetailsTitle");
const projectDetailsContent = document.querySelector("#projectDetailsContent");
const catalogProductDetailsDialog = document.querySelector("#catalogProductDetailsDialog");
const catalogProductDetailsTitle = document.querySelector("#catalogProductDetailsTitle");
const catalogProductDetailsContent = document.querySelector("#catalogProductDetailsContent");
const folioDetailsDialog = document.querySelector("#folioDetailsDialog");
const folioDetailsTitle = document.querySelector("#folioDetailsTitle");
const folioDetailsContent = document.querySelector("#folioDetailsContent");
const templateDetailsDialog = document.querySelector("#templateDetailsDialog");
const templateDetailsTitle = document.querySelector("#templateDetailsTitle");
const templateDetailsContent = document.querySelector("#templateDetailsContent");
const projectEditDialog = document.querySelector("#projectEditDialog");
const projectEditForm = document.querySelector("#projectEditForm");
const editProjectNameInput = document.querySelector("#editProjectNameInput");
const editProjectFolioInput = document.querySelector("#editProjectFolioInput");
const editProjectProductSelect = document.querySelector("#editProjectProductSelect");
const editProjectStartDateInput = document.querySelector("#editProjectStartDateInput");
const editProjectDueDateInput = document.querySelector("#editProjectDueDateInput");
const editProjectDateError = document.querySelector("#editProjectDateError");
const editProjectAssignments = document.querySelector("#editProjectAssignments");
const projectCreationAssignmentsDialog = document.querySelector("#projectCreationAssignmentsDialog");
const projectCreationAssignmentsForm = document.querySelector("#projectCreationAssignmentsForm");
const projectCreationAssignmentName = document.querySelector("#projectCreationAssignmentName");
const createProjectAssignments = document.querySelector("#createProjectAssignments");
const templateDialog = document.querySelector("#templateDialog");
const templateDialogTitle = document.querySelector("#templateDialogTitle");
const templateEditorForm = document.querySelector("#templateEditorForm");
const templateNameInput = document.querySelector("#templateNameInput");
const templateBuilder = document.querySelector("#templateBuilder");
const templatePreview = document.querySelector("#templatePreview");
const productDialog = document.querySelector("#productDialog");
const productDialogTitle = document.querySelector("#productDialogTitle");
const productEditorForm = document.querySelector("#productEditorForm");
const productNameInput = document.querySelector("#productNameInput");
const productCategoryInput = document.querySelector("#productCategoryInput");
const productCategoryExistingSelect = document.querySelector("#productCategoryExistingSelect");
const productFamilyInput = document.querySelector("#productFamilyInput");
const productFamilyExistingSelect = document.querySelector("#productFamilyExistingSelect");
const productVariantInput = document.querySelector("#productVariantInput");
const productVariantExistingSelect = document.querySelector("#productVariantExistingSelect");
const productTemplateSelect = document.querySelector("#productTemplateSelect");
const productMaterialsTable = document.querySelector("#productMaterialsTable");
const productTimeList = document.querySelector("#productTimeList");
const productDocumentList = document.querySelector("#productDocumentList");
const productList = document.querySelector("#productList");
const productSearchInput = document.querySelector("#productSearchInput");
const developerPasswordDialog = document.querySelector("#developerPasswordDialog");
const developerPasswordForm = document.querySelector("#developerPasswordForm");
const developerPasswordInput = document.querySelector("#developerPasswordInput");
const developerPasswordError = document.querySelector("#developerPasswordError");
const returnDialog = document.querySelector("#returnDialog");
const returnForm = document.querySelector("#returnForm");
const returnProjectText = document.querySelector("#returnProjectText");
const returnTargetSelect = document.querySelector("#returnTargetSelect");
const returnCommentInput = document.querySelector("#returnCommentInput");
const blockDialog = document.querySelector("#blockDialog");
const blockForm = document.querySelector("#blockForm");
const blockProjectText = document.querySelector("#blockProjectText");
const blockReasonInput = document.querySelector("#blockReasonInput");
const reopenDialog = document.querySelector("#reopenDialog");
const reopenForm = document.querySelector("#reopenForm");
const reopenProjectText = document.querySelector("#reopenProjectText");
const reopenTargetSelect = document.querySelector("#reopenTargetSelect");
const reopenCommentInput = document.querySelector("#reopenCommentInput");
const profileForm = document.querySelector("#profileForm");
const profileNameInput = document.querySelector("#profileNameInput");
const profileAreaSelect = document.querySelector("#profileAreaSelect");
const profileRoleSelect = document.querySelector("#profileRoleSelect");
const profileCodeInput = document.querySelector("#profileCodeInput");
const profileList = document.querySelector("#profileList");
const profileError = document.querySelector("#profileError");
const saveProfileButton = document.querySelector("#saveProfileButton");
const cancelProfileEditButton = document.querySelector("#cancelProfileEditButton");
const regenerateProfileCodeButton = document.querySelector("#regenerateProfileCodeButton");
const syncStatus = document.querySelector("#syncStatus");
const installAppButton = document.querySelector("#installAppButton");
const readOnlyBanner = document.querySelector("#readOnlyBanner");
const notificationCenter = document.querySelector("#notificationCenter");
const notificationBellButton = document.querySelector("#notificationBellButton");
const notificationBadge = document.querySelector("#notificationBadge");
const notificationPopover = document.querySelector("#notificationPopover");
const notificationFeed = document.querySelector("#notificationFeed");
const clearReadNotificationsButton = document.querySelector("#clearReadNotificationsButton");
let deferredInstallPrompt = null;

ensureAreaForm();

document.querySelector("#backButton").addEventListener("click", handleSessionExit);
notificationBellButton.addEventListener("click", toggleNotificationCenter);
document.querySelector("#closeNotificationsButton").addEventListener("click", closeNotificationCenter);
clearReadNotificationsButton.addEventListener("click", dismissReadNotifications);
document.querySelector("#developerAccessButton").addEventListener("click", requestDeveloperAccess);
document.querySelector("#backToAccessButton").addEventListener("click", leaveDeveloperMode);
document.querySelector("#closeDeveloperPasswordButton").addEventListener("click", closeDeveloperPasswordDialog);
document.querySelector("#cancelDeveloperPasswordButton").addEventListener("click", closeDeveloperPasswordDialog);
developerPasswordForm.addEventListener("submit", unlockDeveloperAccess);
cancelProfileEditButton.addEventListener("click", resetProfileForm);
profileRoleSelect.addEventListener("change", renderProfileAreaOptions);
regenerateProfileCodeButton.addEventListener("click", () => {
  profileCodeInput.value = generateUniqueProfileCode(editingUserId);
});
document.querySelector("#closeHistoryButton").addEventListener("click", () => historyDialog.close());
document.querySelector("#closeProjectDetailsButton").addEventListener("click", () => projectDetailsDialog.close());
document.querySelector("#closeCatalogProductDetailsButton").addEventListener("click", () => catalogProductDetailsDialog.close());
document.querySelector("#closeFolioDetailsButton").addEventListener("click", () => folioDetailsDialog.close());
document.querySelector("#closeTemplateDetailsButton").addEventListener("click", () => templateDetailsDialog.close());
document.querySelector("#closeProjectEditButton").addEventListener("click", () => projectEditDialog.close());
document.querySelector("#cancelProjectEditButton").addEventListener("click", () => projectEditDialog.close());
document.querySelector("#closeProjectCreationAssignmentsButton").addEventListener("click", cancelProjectCreationAssignments);
document.querySelector("#cancelProjectCreationAssignmentsButton").addEventListener("click", cancelProjectCreationAssignments);
projectCreationAssignmentsForm.addEventListener("submit", confirmProjectCreationAssignments);
projectCreationAssignmentsDialog.addEventListener("cancel", () => {
  pendingProjectDraft = null;
});
document.querySelector("#addTemplateButton").addEventListener("click", () => openTemplateEditor());
document.querySelector("#closeTemplateButton").addEventListener("click", () => templateDialog.close());
document.querySelector("#addProductButton").addEventListener("click", () => openProductEditor());
document.querySelector("#closeProductButton").addEventListener("click", () => productDialog.close());
document.querySelector("#cancelProductButton").addEventListener("click", () => productDialog.close());
document.querySelector("#addProductMaterialButton").addEventListener("click", () => {
  editingProductMaterials.push(materialRow("", "", ""));
  renderProductMaterialEditor();
});
document.querySelector("#addProductTimeButton").addEventListener("click", () => {
  editingProductTimes.push({ area: state.areas[0] ?? "Diseno", minutes: 60 });
  renderProductTimeEditor();
});
document.querySelector("#addProductDocumentButton").addEventListener("click", () => {
  editingProductDocuments.push({ title: "", url: "" });
  renderProductDocumentEditor();
});
productSearchInput.addEventListener("input", renderProducts);
projectProductSearchInput.addEventListener("input", renderProductSuggestions);
projectProductCategorySelect.addEventListener("change", handleProjectCategoryChange);
projectProductFamilySelect.addEventListener("change", handleProjectFamilyChange);
projectProductVariantSelect.addEventListener("change", renderProductSelect);
productCategoryExistingSelect.addEventListener("change", () => handleClassificationSelection(productCategoryExistingSelect, productCategoryInput));
productFamilyExistingSelect.addEventListener("change", handleExistingFamilySelection);
productVariantExistingSelect.addEventListener("change", () => handleClassificationSelection(productVariantExistingSelect, productVariantInput));
document.querySelector("#closeReturnButton").addEventListener("click", () => returnDialog.close());
document.querySelector("#cancelReturnButton").addEventListener("click", () => returnDialog.close());
document.querySelector("#closeBlockButton").addEventListener("click", () => blockDialog.close());
document.querySelector("#cancelBlockButton").addEventListener("click", () => blockDialog.close());
document.querySelector("#closeReopenButton").addEventListener("click", () => reopenDialog.close());
document.querySelector("#cancelReopenButton").addEventListener("click", () => reopenDialog.close());
document.querySelector("#deleteSelectedArchiveButton").addEventListener("click", deleteSelectedArchive);
document.querySelector("#deleteAllArchiveButton").addEventListener("click", deleteAllArchive);
document.querySelector("#selectAllArchiveButton").addEventListener("click", selectAllVisibleArchive);
document.querySelector("#unarchiveSelectedButton").addEventListener("click", unarchiveSelected);
document.querySelector("#deleteSelectedAreasButton").addEventListener("click", deleteSelectedAreas);
selectAllProjectsButton.addEventListener("click", selectAllVisibleProjects);
selectCompletedProjectsButton.addEventListener("click", selectVisibleCompletedProjects);
archiveSelectedProjectsButton.addEventListener("click", archiveSelectedProjects);
document.querySelector("#previousMonthButton").addEventListener("click", () => changeCalendarMonth(-1));
document.querySelector("#nextMonthButton").addEventListener("click", () => changeCalendarMonth(1));
adminSearchInput.addEventListener("input", () => {
  adminProjectSelection.clear();
  renderAdminProjects();
});
calendarSearchInput.addEventListener("input", renderCalendar);
calendarArchivedToggle.checked = showArchivedInCalendar;
calendarArchivedToggle.addEventListener("change", () => {
  showArchivedInCalendar = calendarArchivedToggle.checked;
  localStorage.setItem(CALENDAR_ARCHIVE_KEY, String(showArchivedInCalendar));
  renderCalendar();
});
archiveSearchInput.addEventListener("input", () => {
  archiveSelection.clear();
  renderArchive();
});
operatorSearchInput.addEventListener("input", renderOperator);
projectProductSelect.addEventListener("change", applySelectedProductToProjectForm);
projectStartDateInput.addEventListener("change", () => {
  const product = getProduct(projectProductSelect.value);
  if (product && projectStartDateInput.value) {
    applyMinimumDueDate(projectStartDateInput, projectDueDateInput, product, templateSelect.value, projectDateError, true);
  }
});
projectDueDateInput.addEventListener("change", () => validateProjectDates(
  projectStartDateInput,
  projectDueDateInput,
  getProduct(projectProductSelect.value),
  templateSelect.value,
  projectDateError
));
templateSelect.addEventListener("change", () => {
  const product = getProduct(projectProductSelect.value);
  if (product) applyMinimumDueDate(projectStartDateInput, projectDueDateInput, product, templateSelect.value, projectDateError, true);
  renderProjectProductSummary();
});
editProjectProductSelect.addEventListener("change", suggestEditedProjectDueDate);
editProjectStartDateInput.addEventListener("change", suggestEditedProjectDueDate);
editProjectDueDateInput.addEventListener("change", () => validateProjectDates(
  editProjectStartDateInput,
  editProjectDueDateInput,
  getProduct(editProjectProductSelect.value),
  state.projects.find((item) => item.id === editingProjectId)?.templateId,
  editProjectDateError
));
document.querySelector("#addStepButton").addEventListener("click", () => {
  editingNodes.push({ id: createUuid(), area: state.areas[0] ?? "Diseno", nextIds: [] });
  renderTemplateBuilder();
});

projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = projectNameInput.value.trim();
  const folio = projectFolioInput.value.trim();
  const productId = projectProductSelect.value || null;
  const product = getProduct(productId);
  const templateId = templateSelect.value;
  const template = state.templates.find((item) => item.id === templateId);
  if (!name || !template) return;
  const createdAt = new Date().toISOString();
  const startDate = projectStartDateInput.value || dateOnly(createdAt);
  if (!validateProjectDates(projectStartDateInput, projectDueDateInput, product, templateId, projectDateError)) return;
  const dueDate = projectDueDateInput.value || calculateDueDate(startDate, product?.areaMinutes ?? {}, templateId);

  const project = {
    id: createUuid(),
    name,
    folio: folio || null,
    productId,
    templateId,
    activeNodeIds: getStartNodes(template).map((node) => node.id),
    nodeStartedAt: Object.fromEntries(getStartNodes(template).map((node) => [node.id, createdAt])),
    createdAt,
    startDate,
    dueDate,
    estimatedMinutesByArea: structuredClone(product?.areaMinutes ?? {}),
    materials: structuredClone(product?.materials ?? []),
    documents: structuredClone(product?.documents ?? []),
    assignments: {},
    completedAt: null,
    handoffs: [],
    reopenings: [],
    blockedNodes: {},
    blockHistory: [],
    retryTargetsByNode: {},
    history: []
  };

  if (assignOnCreateInput.checked) {
    pendingProjectDraft = project;
    projectCreationAssignmentName.textContent = `${project.name}${project.folio ? ` · Folio ${project.folio}` : ""}`;
    renderAssignmentPicker(createProjectAssignments, template, {});
    projectCreationAssignmentsDialog.showModal();
    return;
  }

  finalizeProjectCreation(project);
});

function finalizeProjectCreation(project) {
  state.projects.unshift(project);
  createNewProjectNotifications(project);
  saveState();
  projectForm.reset();
  setDefaultProjectDates();
  renderAll();
}

function cancelProjectCreationAssignments() {
  pendingProjectDraft = null;
  projectCreationAssignmentsDialog.close();
}

function confirmProjectCreationAssignments(event) {
  event.preventDefault();
  if (!pendingProjectDraft) return;
  pendingProjectDraft.assignments = readAssignmentsFromPicker(createProjectAssignments);
  const project = pendingProjectDraft;
  pendingProjectDraft = null;
  projectCreationAssignmentsDialog.close();
  finalizeProjectCreation(project);
}

templateEditorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveTemplateFromEditor();
});

productEditorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveProductFromEditor();
});

returnForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitReturnRequest();
});

blockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitBlockRequest();
});

reopenForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitReopenRequest();
});

projectEditForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveProjectEdits();
});

areaForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addArea();
});

accessForm.addEventListener("submit", (event) => {
  event.preventDefault();
  signInWithCode();
});

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveProfile();
});

syncStatus.addEventListener("click", async () => {
  syncStatus.disabled = true;
  try {
    await window.productionSync?.reconnect({ force: true });
  } finally {
    syncStatus.disabled = false;
  }
});

resetProfileForm();
setDefaultProjectDates();
initializeAdminSectionControls();
renderLogin();
startApplication();
initializePwa();

async function startApplication() {
  await initializeSharedSync();
  await restoreSession();
}

function ensureAreaForm() {
  const legacyButton = document.querySelector("#addAreaButton");
  if (!areaForm && areaList) {
    areaForm = document.createElement("form");
    areaForm.className = "area-form";
    areaForm.id = "areaForm";
    areaForm.innerHTML = `
      <input id="areaNameInput" type="text" placeholder="Nueva area" required />
      <button class="small-button" type="submit">Agregar</button>
    `;
    const sectionHead = areaList.closest(".admin-section")?.querySelector(".section-head");
    sectionHead?.insertAdjacentElement("afterend", areaForm);
    areaNameInput = areaForm.querySelector("#areaNameInput");
  }
  if (legacyButton) {
    legacyButton.textContent = "Nueva area";
    legacyButton.addEventListener("click", () => areaNameInput?.focus());
  }
}

function initializeAdminSectionControls() {
  document.querySelectorAll("[data-collapse-admin-section]").forEach((button) => {
    const key = button.dataset.collapseAdminSection;
    button.addEventListener("click", () => toggleAdminSection(key));
    updateAdminSectionControl(key);
  });
}

function toggleAdminSection(key) {
  if (collapsedAdminSections.has(key)) {
    collapsedAdminSections.delete(key);
  } else {
    collapsedAdminSections.add(key);
  }
  localStorage.setItem(COLLAPSED_ADMIN_SECTIONS_KEY, JSON.stringify([...collapsedAdminSections]));
  updateAdminSectionControl(key);
}

function updateAdminSectionControl(key) {
  const section = document.querySelector(`[data-collapsible-admin-section="${key}"]`);
  const button = document.querySelector(`[data-collapse-admin-section="${key}"]`);
  if (!section || !button) return;
  const collapsed = collapsedAdminSections.has(key);
  section.classList.toggle("is-collapsed", collapsed);
  button.textContent = collapsed ? "Desplegar" : "Plegar";
  button.setAttribute("aria-expanded", String(!collapsed));
}

function linearTemplate(id, name, steps) {
  return {
    id,
    name,
    nodes: steps.map((area, index) => ({
      id: `${id}-${index}`,
      area,
      nextIds: index < steps.length - 1 ? [`${id}-${index + 1}`] : []
    }))
  };
}

function graphProject(id, name, templateId, activeNodeIds, projectHistory, enteredAt) {
  return {
    id,
    name,
    templateId,
    activeNodeIds,
    nodeStartedAt: Object.fromEntries(activeNodeIds.map((nodeId) => [nodeId, enteredAt])),
    createdAt: "2026-06-20T08:00:00",
    completedAt: null,
    handoffs: [],
    reopenings: [],
    history: projectHistory
  };
}

function history(nodeId, area, user, completedAt) {
  return { nodeId, area, step: area, user, completedAt };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(seedData);
  try {
    return JSON.parse(raw);
  } catch {
    return structuredClone(seedData);
  }
}

function migrateState(data) {
  const migrated = structuredClone(data);
  migrated.notificationReads = migrated.notificationReads ?? {};
  migrated.notificationDismissals = migrated.notificationDismissals ?? {};
  migrated.notifications = (migrated.notifications ?? []).map((notification) => ({
    ...notification,
    id: notification.id ?? createUuid()
  }));
  migrated.areas = migrated.areas?.length ? migrated.areas : defaultAreas;
  migrated.templates = migrated.templates.map((template) => template.nodes ? template : linearTemplate(template.id, template.name, template.steps));
  migrated.products = (migrated.products ?? seedData.products ?? []).map((product) => ({
    id: product.id ?? createUuid(),
    name: product.name ?? "Producto sin nombre",
    category: String(product.category ?? "").trim(),
    family: String(product.family ?? "").trim(),
    variant: String(product.variant ?? "").trim(),
    templateId: product.templateId ?? migrated.templates[0]?.id ?? null,
    materials: normalizeMaterialRows(product.materials),
    areaMinutes: normalizeAreaMinutes(product.areaMinutes, product.areaHours),
    documents: normalizeProductDocuments(product.documents)
  }));
  migrated.projects = migrated.projects.map((project) => {
    const template = migrated.templates.find((item) => item.id === project.templateId) ?? migrated.templates[0];
    if (project.activeNodeIds) {
      project.folio = project.folio ?? null;
      project.handoffs = project.handoffs ?? [];
      project.reopenings = project.reopenings ?? [];
      project.blockedNodes = project.blockedNodes ?? {};
      project.assignments = normalizeProjectAssignments(project.assignments);
      project.retryTargetsByNode = project.retryTargetsByNode ?? {};
      project.blockHistory = project.blockHistory ?? [];
      project.archivedAt = project.archivedAt ?? null;
      project.productId = project.productId ?? null;
      project.documents = normalizeProductDocuments(
        project.documents?.length ? project.documents : getProduct(project.productId, migrated)?.documents
      );
      project.startDate = project.startDate ?? dateOnly(project.createdAt);
      project.dueDate = project.dueDate ?? null;
      project.estimatedMinutesByArea = normalizeAreaMinutes(
        project.estimatedMinutesByArea,
        project.estimatedHoursByArea
      );
      if (Object.keys(project.estimatedMinutesByArea).length === 0) {
        project.estimatedMinutesByArea = getProduct(project.productId, migrated)?.areaMinutes ?? {};
      }
      project.materials = normalizeMaterialRows(project.materials);
      if (project.materials.length === 0) project.materials = getProduct(project.productId, migrated)?.materials ?? [];
      ensureActiveReturnHandoffs(project, template);
      return project;
    }
    const node = template.nodes[project.currentStepIndex ?? 0] ?? template.nodes[0];
    const oldHistory = (project.history ?? []).map((item) => {
      const matchingNode = template.nodes.find((templateNode) => templateNode.area === item.step || templateNode.area === item.area);
      return { ...item, area: item.area ?? item.step, nodeId: item.nodeId ?? matchingNode?.id ?? createUuid() };
    });
    return {
      id: project.id,
      name: project.name,
      folio: project.folio ?? null,
      templateId: project.templateId,
      productId: project.productId ?? null,
      documents: normalizeProductDocuments(
        project.documents?.length ? project.documents : getProduct(project.productId, migrated)?.documents
      ),
      startDate: project.startDate ?? dateOnly(project.createdAt),
      dueDate: project.dueDate ?? null,
      estimatedMinutesByArea: Object.keys(normalizeAreaMinutes(project.estimatedMinutesByArea, project.estimatedHoursByArea)).length
        ? normalizeAreaMinutes(project.estimatedMinutesByArea, project.estimatedHoursByArea)
        : getProduct(project.productId, migrated)?.areaMinutes ?? {},
      materials: normalizeMaterialRows(project.materials).length
        ? normalizeMaterialRows(project.materials)
        : getProduct(project.productId, migrated)?.materials ?? [],
      activeNodeIds: project.completedAt ? [] : [node.id],
      nodeStartedAt: { [node.id]: project.enteredCurrentStepAt ?? new Date().toISOString() },
      createdAt: project.createdAt ?? new Date().toISOString(),
      completedAt: project.completedAt ?? null,
      archivedAt: project.archivedAt ?? null,
      handoffs: project.handoffs ?? [],
      reopenings: project.reopenings ?? [],
      blockedNodes: project.blockedNodes ?? {},
      assignments: normalizeProjectAssignments(project.assignments),
      blockHistory: project.blockHistory ?? [],
      retryTargetsByNode: project.retryTargetsByNode ?? {},
      history: oldHistory
    };
  });
  const usedCodes = new Set();
  const shouldRefreshCodes = migrated.profileCodeVersion !== 2;
  migrated.users = (migrated.users ?? seedData.users).map((user, index) => {
    let code = shouldRefreshCodes ? "" : normalizeCode(user.code);
    if (!code || usedCodes.has(code)) {
      code = generateFiveDigitCode(usedCodes);
    }
    usedCodes.add(code);
    return {
      ...user,
      code,
      role: user.id === "u-diseno" ? "admin" : user.role,
      isPrimaryAdmin: user.isPrimaryAdmin === true || user.id === "u-admin" || user.id === "u-diseno"
    };
  });
  migrated.profileCodeVersion = 2;
  return migrated;
}

function saveState() {
  if (!canModifySharedState) {
    state = migrateState(confirmedState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    return false;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.productionSync?.save(state);
  return true;
}

async function initializeSharedSync() {
  if (!window.productionSync) {
    updateSyncStatus("local", "Modo local");
    return;
  }
  await window.productionSync.initialize({
    initialState: state,
    onRemoteState: applyRemoteState,
    onStatus: ({ mode, message }) => updateSyncStatus(mode, message)
  });
}

function applyRemoteState(remoteState) {
  if (!remoteState?.areas || !remoteState?.templates || !remoteState?.projects) return;
  const currentUserId = currentUser?.id;
  state = migrateState(remoteState);
  confirmedState = structuredClone(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderLogin();

  if (!currentUserId) return;
  currentUser = state.users.find((user) => user.id === currentUserId) ?? null;
  if (!currentUser) {
    localStorage.removeItem(SESSION_KEY);
    showAccessView();
    return;
  }
  renderAll();
}

function updateSyncStatus(mode, message) {
  canModifySharedState = mode === "online";
  syncStatus.className = `sync-status ${mode}`;
  syncStatus.innerHTML = `<span aria-hidden="true"></span>${escapeHtml(message)}`;
  applyWriteLock();
}

function applyWriteLock() {
  const locked = !canModifySharedState;
  readOnlyBanner?.classList.toggle("is-hidden", !locked || workspaceView.classList.contains("is-hidden"));
  const allowedSelector = [
    "input[type='search']",
    ".nav-tab",
    ".icon-button",
    "#backButton",
    "#notificationBellButton",
    "#closeNotificationsButton",
    "#previousMonthButton",
    "#nextMonthButton",
    "#calendarArchivedToggle",
    "#developerPasswordDialog input",
    "#developerPasswordDialog button",
    ".calendar-bar",
    ".calendar-more",
    ".show-history-button",
    ".details-history-button",
    ".section-collapse-button"
  ].join(",");
  const controls = [
    ...workspaceView.querySelectorAll("button, input, select, textarea"),
    ...notificationPopover.querySelectorAll("button"),
    ...document.querySelectorAll("dialog button, dialog input, dialog select, dialog textarea")
  ];
  controls.forEach((control) => {
    const allowed = control.matches(allowedSelector)
      || control.id.startsWith("close")
      || control.id.startsWith("cancel");
    if (locked && !allowed) {
      if (!control.disabled) control.dataset.disabledByWriteLock = "true";
      control.disabled = true;
    } else if (control.dataset.disabledByWriteLock === "true") {
      control.disabled = false;
      delete control.dataset.disabledByWriteLock;
    }
  });
}

function initializePwa() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installAppButton.classList.remove("is-hidden");
  });

  installAppButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installAppButton.classList.add("is-hidden");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installAppButton.classList.add("is-hidden");
  });
}

function renderLogin() {
  userGrid.innerHTML = "";
  state.users.forEach((user) => {
    const button = document.createElement("button");
    button.className = "user-button";
    button.type = "button";
    button.innerHTML = `<strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.area)}</span>`;
    button.addEventListener("click", () => selectUser(user.id, false, true));
    userGrid.appendChild(button);
  });
}

function selectUser(userId, persistSession = true, fromDeveloper = false, accessCode = "") {
  currentUser = state.users.find((user) => user.id === userId);
  if (!currentUser) return;
  developerMode = fromDeveloper;
  if (persistSession) {
    localStorage.setItem(SESSION_KEY, currentUser.id);
    localStorage.setItem(AUTH_CODE_KEY, accessCode || currentUser.code);
    window.productionSync?.setActor(currentUser.id, accessCode || currentUser.code);
  } else if (fromDeveloper) {
    window.productionSync?.setActor(currentUser.id);
  }
  loginView.classList.add("is-hidden");
  developerView.classList.add("is-hidden");
  document.querySelector("#developerAccessButton").classList.add("is-hidden");
  workspaceView.classList.remove("is-hidden");
  document.querySelector("#backButton").textContent = developerMode ? "Cambiar perfil" : "Cerrar sesion";
  activeAdminTab = isPureAdmin(currentUser) ? "shop" : "operator";
  renderAll();
}

async function signInWithCode() {
  const code = normalizeCode(accessCodeInput.value);
  try {
    await window.productionSync?.unlock(code);
    const user = state.users.find((item) => normalizeCode(item.code) === code);
    if (!user) throw new Error("Codigo incorrecto");
    accessError.classList.add("is-hidden");
    accessForm.reset();
    selectUser(user.id, true, false, code);
  } catch {
    accessError.classList.remove("is-hidden");
    accessCodeInput.select();
  }
}

async function restoreSession() {
  const userId = localStorage.getItem(SESSION_KEY);
  const previousProfile = state.users.find((item) => item.id === userId);
  const code = normalizeCode(localStorage.getItem(AUTH_CODE_KEY) || previousProfile?.code);
  if (userId && code) {
    try {
      await window.productionSync?.unlock(code);
      const user = state.users.find((item) => item.id === userId && normalizeCode(item.code) === code);
      if (user) {
        selectUser(userId, true, false, code);
        return;
      }
    } catch {
      // La sesion guardada ya no es valida; se solicita el codigo otra vez.
    }
  }
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(AUTH_CODE_KEY);
  window.productionSync?.lock();
  showAccessView();
}

function handleSessionExit() {
  workspaceView.classList.add("is-hidden");
  closeNotificationCenter();
  notificationCenter.classList.add("is-hidden");
  currentUser = null;
  if (developerMode) {
    showDeveloperView();
    return;
  }
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(AUTH_CODE_KEY);
  window.productionSync?.lock();
  showAccessView();
}

function showAccessView() {
  workspaceView.classList.add("is-hidden");
  developerView.classList.add("is-hidden");
  loginView.classList.remove("is-hidden");
  notificationCenter.classList.add("is-hidden");
  document.querySelector("#developerAccessButton").classList.remove("is-hidden");
  accessError.classList.add("is-hidden");
  accessCodeInput.focus();
}

async function requestDeveloperAccess() {
  developerPasswordForm.reset();
  developerPasswordError.classList.add("is-hidden");
  developerPasswordDialog.showModal();
  developerPasswordInput.focus();
}

function closeDeveloperPasswordDialog() {
  developerPasswordForm.reset();
  developerPasswordError.classList.add("is-hidden");
  developerPasswordDialog.close();
}

async function unlockDeveloperAccess(event) {
  event.preventDefault();
  const password = developerPasswordInput.value;
  const submitButton = developerPasswordForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const configured = await window.productionSync?.developerPasswordConfigured();
    if (!configured) throw new Error("La contraseña de desarrollador todavía no está configurada.");
    await window.productionSync.unlockDeveloper(password);
    developerMode = true;
    closeDeveloperPasswordDialog();
    showDeveloperView();
  } catch (error) {
    developerPasswordError.textContent = error.message.includes("configurada")
      ? error.message
      : "Contraseña incorrecta.";
    developerPasswordError.classList.remove("is-hidden");
    developerPasswordInput.select();
  } finally {
    submitButton.disabled = false;
  }
}

function leaveDeveloperMode() {
  developerMode = false;
  currentUser = null;
  window.productionSync?.lock();
  showAccessView();
}

function showDeveloperView() {
  workspaceView.classList.add("is-hidden");
  loginView.classList.add("is-hidden");
  developerView.classList.remove("is-hidden");
  notificationCenter.classList.add("is-hidden");
  document.querySelector("#developerAccessButton").classList.add("is-hidden");
  renderLogin();
}

function renderAll() {
  if (!currentUser) return;
  currentUserName.textContent = currentUser.name;
  currentUserArea.textContent = currentUser.area;
  currentAreaDot.style.background = hasAdminAccess(currentUser) ? "#f2bb46" : "#65b17b";
  renderNotificationCenter();
  renderTabs();
  renderOperator();
  renderAdmin();
  renderArchive();
  applyWriteLock();
}

function renderTabs() {
  navTabs.innerHTML = "";
  const tabs = getTabsForUser(currentUser);

  tabs.forEach((tab) => {
    const button = document.createElement("button");
    button.className = `nav-tab ${activeAdminTab === tab.id ? "is-active" : ""}`;
    button.type = "button";
    button.textContent = tab.label;
    button.addEventListener("click", () => {
      activeAdminTab = tab.id;
      renderAll();
    });
    navTabs.appendChild(button);
  });

  operatorView.classList.toggle("is-hidden", !["operator", "shop"].includes(activeAdminTab));
  adminView.classList.toggle("is-hidden", activeAdminTab !== "admin");
  productsView.classList.toggle("is-hidden", activeAdminTab !== "products");
  calendarView.classList.toggle("is-hidden", activeAdminTab !== "calendar");
  archiveView.classList.toggle("is-hidden", activeAdminTab !== "archive");
}

function renderOperator() {
  if (activeAdminTab === "shop") {
    renderShopFloorView();
    return;
  }

  const area = currentUser.area;
  const query = normalizeSearch(operatorSearchInput.value);
  operatorTitle.textContent = area;
  const pending = state.projects
    .filter((project) => projectMatchesSearch(project, query))
    .flatMap((project) => getActiveNodes(project)
      .filter((node) => node.area === area && isNodeAssignedToUser(project, node, currentUser))
      .map((node) => ({ project, node })));
  const completedWaiting = state.projects
    .filter((project) => projectMatchesSearch(project, query))
    .flatMap((project) => getCompletedWaitingNodes(project, area).map((handoff) => ({ handoff, project, node: getNode(getTemplate(project), handoff.fromNodeId) })))
    .filter((item) => item.node && isNodeAssignedToUser(item.project, item.node, currentUser));
  const upcoming = state.projects
    .filter((project) => projectMatchesSearch(project, query))
    .flatMap((project) => getUpcomingNodes(project, area)
      .filter((node) => isNodeAssignedToUser(project, node, currentUser))
      .map((node) => ({ project, node })));
  pendingCount.textContent = `${pending.length} ${pending.length === 1 ? "pendiente" : "pendientes"}`;
  operatorProjects.innerHTML = "";

  if (pending.length === 0 && completedWaiting.length === 0 && upcoming.length === 0) {
    operatorProjects.innerHTML = `<div class="empty-state">${query ? "No se encontraron pedidos." : `No hay proyectos esperando en ${escapeHtml(area)}. Cuando llegue uno, aparecera aqui sin buscarlo.`}</div>`;
    return;
  }

  if (pending.length > 0) {
    const pendingGroup = document.createElement("section");
    pendingGroup.className = "operator-group";
    pendingGroup.innerHTML = `<p class="eyebrow">Pendientes para terminar</p>`;
    pending.forEach(({ project, node }) => pendingGroup.appendChild(renderOperatorCard(project, node, "pending")));
    operatorProjects.appendChild(pendingGroup);
  }

  if (completedWaiting.length > 0) {
    const completedGroup = document.createElement("section");
    completedGroup.className = "operator-group";
    completedGroup.innerHTML = `<p class="eyebrow muted">Terminados esperando revision</p>`;
    completedWaiting.forEach(({ project, node, handoff }) => completedGroup.appendChild(renderOperatorCard(project, node, "completed", handoff)));
    operatorProjects.appendChild(completedGroup);
  }

  if (upcoming.length > 0) {
    const upcomingGroup = document.createElement("section");
    upcomingGroup.className = "operator-group";
    upcomingGroup.innerHTML = `<p class="eyebrow muted">Proximos</p>`;
    upcoming.forEach(({ project, node }) => upcomingGroup.appendChild(renderOperatorCard(project, node, "upcoming")));
    operatorProjects.appendChild(upcomingGroup);
  }
}

function renderShopFloorView() {
  const query = normalizeSearch(operatorSearchInput.value);
  const activeItems = state.projects
    .filter((project) => projectMatchesSearch(project, query))
    .flatMap((project) => getActiveNodes(project).map((node) => ({ project, node })));
  const totalPending = activeItems.length;

  operatorTitle.textContent = "Vista taller";
  pendingCount.textContent = `${totalPending} ${totalPending === 1 ? "pendiente" : "pendientes"}`;
  operatorProjects.innerHTML = "";

  if (activeItems.length === 0) {
    operatorProjects.innerHTML = `<div class="empty-state">${query ? "No se encontraron pedidos." : "No hay trabajos pendientes en el taller."}</div>`;
    return;
  }

  state.areas.forEach((area) => {
    const areaPending = activeItems.filter((item) => item.node.area === area);
    if (areaPending.length === 0) return;

    const areaSection = document.createElement("section");
    areaSection.className = "shop-area";
    applyAreaColor(areaSection, area);
    areaSection.innerHTML = `
      <div class="shop-area-head">
        <h3>${escapeHtml(area)}</h3>
        <span class="count-pill">${areaPending.length} ${areaPending.length === 1 ? "pendiente" : "pendientes"}</span>
      </div>
    `;

    areaPending.forEach(({ project, node }) => {
      areaSection.appendChild(renderOperatorCard(project, node, "pending"));
    });

    operatorProjects.appendChild(areaSection);
  });
}

function renderOperatorCard(project, node, mode, handoff = null) {
  const template = getTemplate(project);
  const product = getProduct(project.productId);
  const nextAreas = node.nextIds.map((nodeId) => getNode(template, nodeId)?.area).filter(Boolean);
  const waitingAreas = getPreviousNodes(template, node.id).filter((previous) => !isNodeDone(project, previous.id)).map((previous) => previous.area);
  const incomingHandoffs = getOpenIncomingHandoffs(project, node.id);
  const estimatedMinutes = Number(project.estimatedMinutesByArea?.[node.area]) || 0;
  const schedule = getScheduleStatus(project);
  const block = project.blockedNodes?.[node.id] ?? null;
  const assignedUsers = getAssignedUsers(project, node.id);
  const documents = getProjectDocuments(project);
  const retryAreas = (project.retryTargetsByNode?.[node.id] ?? [])
    .map((nextId) => getNode(template, nextId)?.area)
    .filter(Boolean);
  const canBlock = mode === "pending" && currentUser?.area === node.area;
  const card = document.createElement("article");
  card.className = `project-card worker ${["upcoming", "completed"].includes(mode) ? mode : ""} ${block ? "blocked" : ""}`;
  applyAreaColor(card, node.area);
  card.innerHTML = `
    <div>
      <p class="eyebrow">${mode === "upcoming" ? "Proximo" : mode === "completed" ? "Terminado" : "Proyecto"}</p>
      <h3>${escapeHtml(project.name)}</h3>
      <div class="project-meta">
        ${project.folio
          ? `<button class="meta-chip folio-chip interactive-chip" data-action="folio-details" type="button">Folio: ${escapeHtml(project.folio)}</button>`
          : `<span class="meta-chip folio-chip is-empty">Sin folio</span>`}
        ${product ? `<button class="meta-chip strong-chip interactive-chip" data-action="product-details" type="button">Producto: ${escapeHtml(product.name)}</button>` : ""}
        <span class="meta-chip">Proceso: ${escapeHtml(node.area)}</span>
        <span class="meta-chip assignee-chip">${assignedUsers.length
          ? `Responsables: ${escapeHtml(formatAssignedUsers(assignedUsers))}`
          : "Responsables: Toda el area"}</span>
        ${retryAreas.length ? `<span class="meta-chip retry-chip">Reenviar solo a: ${escapeHtml(retryAreas.join(" + "))}</span>` : ""}
        ${mode === "completed"
          ? `<span class="meta-chip">Esperando: ${escapeHtml(handoff?.toArea ?? "siguiente proceso")}</span>`
          : mode === "upcoming"
          ? `<span class="meta-chip">Esperando: ${escapeHtml(waitingAreas.join(" + ") || "area anterior")}</span>`
          : `<span class="meta-chip">Lleva aqui: ${escapeHtml(timeInNode(project, node.id))}</span>`}
        <span class="meta-chip estimate-chip">${estimatedMinutes > 0 ? `Estimado: ${escapeHtml(formatEstimatedDuration(estimatedMinutes))}` : "Sin tiempo estimado"}</span>
        <span class="meta-chip deadline-chip ${schedule.type === "late" ? "late-chip" : ""}">${project.dueDate ? `Entrega: ${escapeHtml(formatPlainDate(project.dueDate))} · ${escapeHtml(schedule.label)}` : "Entrega pendiente"}</span>
        <span class="meta-chip">Siguiente: ${escapeHtml(nextAreas.join(" + ") || "Terminado")}</span>
      </div>
    </div>
    ${mode === "completed"
      ? `<div class="upcoming-panel"><strong>Entregado</strong><span>Se quitara cuando ${escapeHtml(handoff?.toArea ?? "el siguiente")} termine o lo regrese.</span>${documents.length ? `<button class="history-button project-documents-button" type="button">Documentos (${documents.length})</button>` : ""}</div>`
      : mode === "upcoming"
      ? `<div class="upcoming-panel"><strong>No accionable</strong><span>Se activara cuando termine el area anterior.</span>${documents.length ? `<button class="history-button project-documents-button" type="button">Documentos (${documents.length})</button>` : ""}</div>`
      : block
      ? `<div class="blocked-panel">
          <strong>Proceso bloqueado</strong>
          <span>${escapeHtml(block.reason)}</span>
          <small>Desde ${escapeHtml(formatDate(block.blockedAt))} por ${escapeHtml(block.blockedBy)}</small>
          ${hasAdminAccess(currentUser) || currentUser?.area === node.area
            ? `<button class="primary-button direct-unlock-button" type="button">Desbloquear proceso</button>`
            : ""}
          ${documents.length ? `<button class="history-button project-documents-button" type="button">Documentos (${documents.length})</button>` : ""}
        </div>`
      : `<div class="action-stack">
          <button class="finish-button" type="button">Terminar proceso</button>
          ${incomingHandoffs.length > 0 ? `<button class="return-button" type="button">Regresar al proceso anterior</button>` : ""}
          ${canBlock ? `<button class="block-button" type="button">Bloquear proceso</button>` : ""}
          ${documents.length ? `<button class="history-button project-documents-button" type="button">Documentos (${documents.length})</button>` : ""}
        </div>`}
  `;
  if (mode === "pending" && !block) {
    card.querySelector(".finish-button").addEventListener("click", () => finishNode(project.id, node.id));
    const returnButton = card.querySelector(".return-button");
    if (returnButton) {
      returnButton.addEventListener("click", () => openReturnDialog(project.id, node.id));
    }
    card.querySelector(".block-button")?.addEventListener("click", () => openBlockDialog(project.id, node.id));
  }
  card.querySelector('[data-action="product-details"]')?.addEventListener("click", () => showCatalogProductDetails(product.id));
  card.querySelector('[data-action="folio-details"]')?.addEventListener("click", () => showFolioDetails(project.folio));
  card.querySelector(".project-documents-button")?.addEventListener("click", () => showProjectDetails(project.id));
  card.querySelector(".direct-unlock-button")?.addEventListener("click", () => resolveProcessBlock(project.id, node.id));
  return card;
}

function applyAreaColor(element, area) {
  const color = areaColor(area);
  element.style.setProperty("--area-soft", color.soft);
  element.style.setProperty("--area-border", color.border);
  element.style.setProperty("--area-strong", color.strong);
}

function areaColor(area) {
  const palette = [
    ["#e8f1fb", "#8eb4da", "#245d91"],
    ["#f7e9ee", "#d9a0b4", "#873d58"],
    ["#e9f4e7", "#9ac491", "#356f31"],
    ["#fff0dc", "#e4b06b", "#87540f"],
    ["#eeeafa", "#aaa0d8", "#53458e"],
    ["#e2f3f1", "#84c1ba", "#206b64"],
    ["#f3ebdf", "#c9ae83", "#70522a"],
    ["#fbe9e5", "#dfa093", "#8d4034"]
  ];
  let hash = 0;
  for (const character of String(area)) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  const [soft, border, strong] = palette[Math.abs(hash) % palette.length];
  return { soft, border, strong };
}

function renderAdmin() {
  renderProductSelect();
  renderTemplateSelect();
  renderAreaList();
  renderTemplateList();
  renderProfiles();
  renderAdminProjects();
  renderProducts();
  renderCalendar();
}

function hasAdminAccess(user) {
  return user?.role === "admin" || user?.area === "Diseno";
}

function normalizeProjectAssignments(assignments = {}) {
  return Object.fromEntries(
    Object.entries(assignments ?? {})
      .map(([nodeId, userIds]) => [
        nodeId,
        [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean))]
      ])
      .filter(([, userIds]) => userIds.length > 0)
  );
}

function getAssignedUsers(project, nodeId) {
  const userIds = normalizeProjectAssignments(project.assignments)[nodeId] ?? [];
  return userIds.map((userId) => state.users.find((user) => user.id === userId)).filter(Boolean);
}

function isNodeAssignedToUser(project, node, user) {
  const assignedUsers = getAssignedUsers(project, node.id);
  return assignedUsers.length === 0 || assignedUsers.some((assignedUser) => assignedUser.id === user?.id);
}

function formatAssignedUsers(users) {
  if (users.length <= 2) return users.map((user) => user.name).join(", ");
  return `${users.slice(0, 2).map((user) => user.name).join(", ")} +${users.length - 2}`;
}

function isPureAdmin(user) {
  return user?.role === "admin" && user?.area === "Administracion";
}

function getTabsForUser(user) {
  if (isPureAdmin(user)) {
    return [
      { id: "shop", label: "Vista taller" },
      { id: "admin", label: "Administracion" },
      { id: "products", label: "Productos" },
      { id: "calendar", label: "Calendario" },
      { id: "archive", label: "Archivo" }
    ];
  }
  if (hasAdminAccess(user)) {
    return [
      { id: "operator", label: "Mis pendientes" },
      { id: "shop", label: "Vista taller" },
      { id: "admin", label: "Administracion" },
      { id: "products", label: "Productos" },
      { id: "calendar", label: "Calendario" },
      { id: "archive", label: "Archivo" }
    ];
  }
  return [
    { id: "operator", label: "Mis pendientes" },
    { id: "calendar", label: "Calendario" }
  ];
}

function renderProductSelect() {
  const selected = projectProductSelect.value;
  renderProjectProductCascade();
  const category = projectProductCategorySelect.value;
  const family = projectProductFamilySelect.value;
  const variant = projectProductVariantSelect.value;
  const products = state.products
    .filter((product) => (!category || product.category === category)
      && (!family || product.family === family)
      && (!variant || product.variant === variant))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  projectProductSelect.innerHTML = `<option value="">Sin producto base</option>` + products
    .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}</option>`)
    .join("");
  if (state.products.some((product) => product.id === selected)) projectProductSelect.value = selected;
  renderProductTemplateOptions();
  renderProjectProductSummary();
}

function renderProjectProductCascade() {
  const selectedCategory = projectProductCategorySelect.value;
  const categories = uniqueCatalogValues(state.products, "category");
  projectProductCategorySelect.innerHTML = `<option value="">Todos los tipos</option>${categories.map(optionHtml).join("")}`;
  if (categories.includes(selectedCategory)) projectProductCategorySelect.value = selectedCategory;

  const selectedFamily = projectProductFamilySelect.value;
  const familyProducts = state.products.filter((product) => !projectProductCategorySelect.value || product.category === projectProductCategorySelect.value);
  const families = uniqueCatalogValues(familyProducts, "family");
  projectProductFamilySelect.innerHTML = `<option value="">Todas las familias</option>${families.map(optionHtml).join("")}`;
  if (families.includes(selectedFamily)) projectProductFamilySelect.value = selectedFamily;

  const selectedVariant = projectProductVariantSelect.value;
  const variantProducts = familyProducts.filter((product) => !projectProductFamilySelect.value || product.family === projectProductFamilySelect.value);
  const variants = uniqueCatalogValues(variantProducts, "variant");
  projectProductVariantSelect.innerHTML = `<option value="">Todas las variantes</option>${variants.map(optionHtml).join("")}`;
  if (variants.includes(selectedVariant)) projectProductVariantSelect.value = selectedVariant;
}

function handleProjectCategoryChange() {
  projectProductFamilySelect.value = "";
  projectProductVariantSelect.value = "";
  projectProductSelect.value = "";
  renderProductSelect();
}

function handleProjectFamilyChange() {
  projectProductVariantSelect.value = "";
  projectProductSelect.value = "";
  renderProductSelect();
}

function renderProductSuggestions() {
  const query = normalizeSearch(projectProductSearchInput.value);
  projectProductSuggestions.innerHTML = "";
  if (!query) {
    projectProductSuggestions.classList.add("is-hidden");
    return;
  }
  const matches = state.products
    .filter((product) => productMatchesCatalogSearch(product, query))
    .sort((a, b) => {
      const aName = normalizeSearch(productCatalogPath(a));
      const bName = normalizeSearch(productCatalogPath(b));
      return Number(bName.startsWith(query)) - Number(aName.startsWith(query)) || aName.localeCompare(bName, "es");
    })
    .slice(0, 6);
  if (matches.length === 0) {
    projectProductSuggestions.innerHTML = `<p>No se encontraron productos.</p>`;
    projectProductSuggestions.classList.remove("is-hidden");
    return;
  }
  matches.forEach((product) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(productCatalogPath(product))}</span>`;
    button.addEventListener("click", () => selectProductFromSearch(product));
    projectProductSuggestions.appendChild(button);
  });
  projectProductSuggestions.classList.remove("is-hidden");
}

function selectProductFromSearch(product) {
  projectProductCategorySelect.value = product.category || "";
  renderProjectProductCascade();
  projectProductFamilySelect.value = product.family || "";
  renderProjectProductCascade();
  projectProductVariantSelect.value = product.variant || "";
  renderProductSelect();
  projectProductSelect.value = product.id;
  projectProductSearchInput.value = product.name;
  projectProductSuggestions.classList.add("is-hidden");
  applySelectedProductToProjectForm();
}

function uniqueCatalogValues(products, field) {
  return [...new Set(products.map((product) => String(product[field] ?? "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
}

function optionHtml(value) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`;
}

function productCatalogPath(product) {
  return [product.category, product.family, product.variant].filter(Boolean).join(" / ");
}

function productCatalogLabel(product) {
  return [product.variant, product.name].filter(Boolean).join(" · ");
}

function productMatchesCatalogSearch(product, query) {
  return normalizeSearch([
    product.name,
    product.category,
    product.family,
    product.variant
  ].filter(Boolean).join(" ")).includes(query);
}

function applySelectedProductToProjectForm() {
  const product = getProduct(projectProductSelect.value);
  if (product) {
    projectProductSearchInput.value = product.name;
    projectNameInput.value = product.name;
    if (state.templates.some((template) => template.id === product.templateId)) templateSelect.value = product.templateId;
    const startDate = projectStartDateInput.value || dateOnly(new Date());
    projectStartDateInput.value = startDate;
    applyMinimumDueDate(projectStartDateInput, projectDueDateInput, product, templateSelect.value, projectDateError, true);
  } else {
    projectProductSearchInput.value = "";
    projectDueDateInput.min = projectStartDateInput.value || "";
    clearDateError(projectDueDateInput, projectDateError);
  }
  renderProjectProductSummary();
}

function renderProjectProductSummary() {
  const product = getProduct(projectProductSelect.value);
  if (!product) {
    projectProductSummary.classList.add("is-hidden");
    projectProductSummary.innerHTML = "";
    return;
  }
  projectProductSummary.classList.remove("is-hidden");
  projectProductSummary.innerHTML = `
    <strong>${escapeHtml(totalMinutes(product.areaMinutes))} min estimados</strong>
    <span>Ruta critica: ${escapeHtml(formatMinutesAsHours(criticalPathMinutes(product.areaMinutes, templateSelect.value || product.templateId)))}</span>
    <span>${escapeHtml(product.materials.length)} materiales registrados</span>
  `;
}

function setDefaultProjectDates() {
  if (!projectStartDateInput || !projectDueDateInput) return;
  projectStartDateInput.value = dateOnly(new Date());
  projectDueDateInput.value = "";
  projectDueDateInput.min = projectStartDateInput.value;
  clearDateError(projectDueDateInput, projectDateError);
  renderProjectProductSummary();
}

function renderTemplateSelect() {
  const selected = templateSelect.value;
  templateSelect.innerHTML = "";
  state.templates.forEach((template) => {
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = template.name;
    templateSelect.appendChild(option);
  });
  if (state.templates.some((template) => template.id === selected)) templateSelect.value = selected;
}

function renderAreaList() {
  areaList.innerHTML = "";
  state.areas.forEach((area, index) => {
    const row = document.createElement("div");
    row.className = "area-row";
    row.innerHTML = `
      <label class="area-select">
        <input type="checkbox" data-area="${escapeHtml(area)}" ${areaSelection.has(area) ? "checked" : ""} />
        <strong>${escapeHtml(area)}</strong>
      </label>
      <div class="order-actions">
        <button class="icon-button tiny" data-move="-1" type="button" title="Subir" ${index === 0 ? "disabled" : ""}>&#8593;</button>
        <button class="icon-button tiny" data-move="1" type="button" title="Bajar" ${index === state.areas.length - 1 ? "disabled" : ""}>&#8595;</button>
      </div>
    `;
    row.querySelector("input").addEventListener("change", (event) => {
      if (event.target.checked) areaSelection.add(area);
      else areaSelection.delete(area);
      updateAreaDeleteButton();
    });
    row.querySelectorAll("[data-move]").forEach((button) => {
      button.addEventListener("click", () => moveArea(index, Number(button.dataset.move)));
    });
    areaList.appendChild(row);
  });
  updateAreaDeleteButton();
}

function moveArea(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.areas.length) return;
  [state.areas[index], state.areas[targetIndex]] = [state.areas[targetIndex], state.areas[index]];
  saveState();
  renderAll();
}

function renderProfiles() {
  renderProfileAreaOptions();
  profileList.innerHTML = "";
  const orderedAreas = [...state.areas, "Administracion"];
  const extraAreas = state.users.map((user) => user.area).filter((area) => !orderedAreas.includes(area));
  [...orderedAreas, ...extraAreas].forEach((area, index) => {
    const users = state.users
      .filter((user) => user.area === area)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    if (users.length === 0) return;

    const group = document.createElement("section");
    group.className = `profile-area-group tone-${index % 8}`;
    group.innerHTML = `
      <div class="profile-area-heading">
        <strong>${escapeHtml(area)}</strong>
        <span>${users.length} ${users.length === 1 ? "perfil" : "perfiles"}</span>
      </div>
      <div class="profile-area-cards"></div>
    `;
    const cards = group.querySelector(".profile-area-cards");
    users.forEach((user) => {
      const row = document.createElement("article");
      row.className = "profile-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(user.name)}</strong>
          <div class="profile-meta">
            <span class="profile-role-badge">${escapeHtml(user.role === "admin" ? "Administrador" : "Operario")}</span>
            ${user.isPrimaryAdmin ? `<span class="profile-primary-badge">Principal</span>` : ""}
            <span class="profile-code">Codigo: ${escapeHtml(user.code)}</span>
          </div>
        </div>
        <div class="profile-actions">
          <button class="history-button tiny" data-action="edit" type="button">Editar</button>
          ${user.isPrimaryAdmin ? "" : `<button class="danger-button tiny" data-action="delete" type="button">Borrar</button>`}
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener("click", () => editProfile(user.id));
      row.querySelector('[data-action="delete"]')?.addEventListener("click", () => deleteProfile(user.id));
      cards.appendChild(row);
    });
    profileList.appendChild(group);
  });
}

function renderProfileAreaOptions() {
  const selectedArea = profileAreaSelect.value;
  const areas = [...state.areas, "Administracion"];
  profileAreaSelect.disabled = false;
  profileAreaSelect.innerHTML = areas
    .map((area) => `<option value="${escapeHtml(area)}">${escapeHtml(area)}</option>`)
    .join("");
  if (areas.includes(selectedArea)) profileAreaSelect.value = selectedArea;
}

function saveProfile() {
  const name = profileNameInput.value.trim();
  const code = normalizeCode(profileCodeInput.value);
  const role = profileRoleSelect.value;
  const area = profileAreaSelect.value;
  const duplicateCode = state.users.some((user) => user.id !== editingUserId && normalizeCode(user.code) === code);

  if (!name || !code || !area) {
    showProfileError("Completa nombre, area y codigo.");
    return;
  }
  if (!/^\d{5}$/.test(code)) {
    showProfileError("El codigo debe tener exactamente 5 numeros.");
    return;
  }
  if (duplicateCode) {
    showProfileError("Ese codigo ya pertenece a otro perfil.");
    return;
  }
  const editingUser = state.users.find((user) => user.id === editingUserId);
  const adminCount = state.users.filter((user) => user.role === "admin").length;
  if (editingUser?.isPrimaryAdmin && role !== "admin") {
    showProfileError("Un administrador principal no puede convertirse en operario.");
    return;
  }
  if (editingUser?.role === "admin" && role !== "admin" && adminCount === 1) {
    showProfileError("Debe existir al menos un administrador.");
    return;
  }

  if (editingUserId) {
    const user = editingUser;
    if (!user) return;
    Object.assign(user, { name, area, role, code });
    if (currentUser?.id === user.id) currentUser = user;
  } else {
    state.users.push({ id: createUuid(), name, area, role, code });
  }
  saveState();
  resetProfileForm();
  renderLogin();
  renderAll();
}

function editProfile(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  editingUserId = userId;
  profileNameInput.value = user.name;
  profileRoleSelect.value = user.role;
  renderProfileAreaOptions();
  profileAreaSelect.value = user.area;
  profileCodeInput.value = user.code;
  saveProfileButton.textContent = "Guardar cambios";
  cancelProfileEditButton.classList.remove("is-hidden");
  profileError.classList.add("is-hidden");
  profileNameInput.focus();
}

function resetProfileForm() {
  editingUserId = null;
  profileForm.reset();
  profileRoleSelect.value = "worker";
  renderProfileAreaOptions();
  profileCodeInput.value = generateUniqueProfileCode();
  saveProfileButton.textContent = "Crear perfil";
  cancelProfileEditButton.classList.add("is-hidden");
  profileError.classList.add("is-hidden");
}

function deleteProfile(userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return;
  if (user.isPrimaryAdmin) {
    showProfileError("El administrador principal no se puede borrar.");
    return;
  }
  if (currentUser?.id === user.id) {
    showProfileError("No puedes borrar el perfil que estas usando.");
    return;
  }
  const adminCount = state.users.filter((item) => item.role === "admin").length;
  if (user.role === "admin" && adminCount === 1) {
    showProfileError("Debe existir al menos un administrador.");
    return;
  }
  if (!confirm(`Borrar el perfil de "${user.name}"?`)) return;
  state.users = state.users.filter((item) => item.id !== userId);
  if (editingUserId === userId) resetProfileForm();
  saveState();
  renderLogin();
  renderAll();
}

function showProfileError(message) {
  profileError.textContent = message;
  profileError.classList.remove("is-hidden");
}

function updateAreaDeleteButton() {
  const button = document.querySelector("#deleteSelectedAreasButton");
  button.disabled = areaSelection.size === 0;
  button.textContent = areaSelection.size > 0
    ? `Borrar seleccionadas (${areaSelection.size})`
    : "Borrar seleccionadas";
}

function deleteSelectedAreas() {
  if (areaSelection.size === 0) return;
  const selectedAreas = [...areaSelection];
  const blockedAreas = selectedAreas.filter((area) =>
    state.templates.some((template) => template.nodes.some((node) => node.area === area))
  );
  if (blockedAreas.length > 0) {
    alert(`No se puede borrar porque estas areas estan usadas en plantillas: ${blockedAreas.join(", ")}.`);
    return;
  }
  if (!confirm(`Borrar ${selectedAreas.length} ${selectedAreas.length === 1 ? "area seleccionada" : "areas seleccionadas"}?`)) return;
  const selectedSet = new Set(selectedAreas);
  state.areas = state.areas.filter((area) => !selectedSet.has(area));
  state.users = state.users.filter((user) => !selectedSet.has(user.area));
  areaSelection.clear();
  saveState();
  renderLogin();
  renderAll();
}

function renderTemplateList() {
  templateList.innerHTML = "";
  state.templates.forEach((template, index) => {
    const collapsed = collapsedTemplates.has(template.id);
    const card = document.createElement("article");
    card.className = `template-card ${collapsed ? "collapsed" : ""}`;
    card.innerHTML = `
      <div class="template-card-head">
        <button class="template-name-button" type="button" data-action="view">${escapeHtml(template.name)}</button>
        <div class="template-card-actions">
          <button class="icon-button tiny" type="button" data-action="up" title="Subir" ${index === 0 ? "disabled" : ""}>&#8593;</button>
          <button class="icon-button tiny" type="button" data-action="down" title="Bajar" ${index === state.templates.length - 1 ? "disabled" : ""}>&#8595;</button>
          <button class="history-button tiny" type="button" data-action="toggle">${collapsed ? "Mostrar" : "Ocultar"}</button>
          <button class="history-button tiny" type="button" data-action="edit">Editar</button>
          <button class="danger-button tiny" type="button" data-action="delete">Borrar</button>
        </div>
      </div>
      ${collapsed ? "" : `<div class="flow-preview">${renderFlowPreview(template)}</div>`}
    `;
    card.querySelector('[data-action="view"]').addEventListener("click", () => showTemplateDetails(template.id));
    card.querySelector('[data-action="toggle"]').addEventListener("click", () => toggleTemplateCollapsed(template.id));
    card.querySelector('[data-action="up"]').addEventListener("click", () => moveTemplate(index, -1));
    card.querySelector('[data-action="down"]').addEventListener("click", () => moveTemplate(index, 1));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => openTemplateEditor(template.id));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteTemplate(template.id));
    templateList.appendChild(card);
  });
}

function toggleTemplateCollapsed(templateId) {
  if (collapsedTemplates.has(templateId)) collapsedTemplates.delete(templateId);
  else collapsedTemplates.add(templateId);
  localStorage.setItem(COLLAPSED_TEMPLATES_KEY, JSON.stringify([...collapsedTemplates]));
  renderTemplateList();
}

function moveTemplate(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.templates.length) return;
  [state.templates[index], state.templates[targetIndex]] = [state.templates[targetIndex], state.templates[index]];
  saveState();
  renderAll();
}

function showTemplateDetails(templateId) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template) return;
  templateDetailsTitle.textContent = template.name;
  templateDetailsContent.innerHTML = renderFlowTree(template);
  templateDetailsDialog.showModal();
}

function renderFlowPreview(template) {
  return renderFlowTree(template);
}

function renderProducts() {
  productList.innerHTML = "";
  const query = normalizeSearch(productSearchInput.value);
  const products = state.products
    .filter((product) => !query || productMatchesCatalogSearch(product, query))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (products.length === 0) {
    productList.innerHTML = `<div class="empty-state">${query ? "No hay productos que coincidan con la busqueda." : "Todavia no hay productos base. Crea uno para guardar materiales y tiempos estimados."}</div>`;
    return;
  }
  const categories = new Map();
  products.forEach((product) => {
    const category = product.category || "Sin categoria";
    const family = product.family || "Sin familia";
    if (!categories.has(category)) categories.set(category, new Map());
    const families = categories.get(category);
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(product);
  });

  categories.forEach((families, category) => {
    const categorySection = document.createElement("section");
    categorySection.className = "product-category";
    categorySection.innerHTML = `
      <div class="product-category-head">
        <div>
          <p class="eyebrow muted">Tipo</p>
          <h3>${escapeHtml(category)}</h3>
        </div>
        <span>${[...families.values()].flat().length} productos</span>
      </div>
      <div class="product-family-list"></div>
    `;
    const familyList = categorySection.querySelector(".product-family-list");
    families.forEach((familyProducts, family) => {
      const familySection = document.createElement("details");
      familySection.className = "product-family";
      familySection.open = Boolean(query) || families.size === 1;
      familySection.innerHTML = `
        <summary>
          <strong>${escapeHtml(family)}</strong>
          <span>${familyProducts.length} ${familyProducts.length === 1 ? "variante" : "variantes"}</span>
        </summary>
        <div class="product-family-products"></div>
      `;
      const cards = familySection.querySelector(".product-family-products");
      familyProducts.forEach((product) => {
      const template = state.templates.find((item) => item.id === product.templateId);
      const card = document.createElement("article");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-card-head">
          <div>
            ${product.variant ? `<p class="product-variant">${escapeHtml(product.variant)}</p>` : ""}
            <h3>${escapeHtml(product.name)}</h3>
            <div class="project-meta">
              <span class="meta-chip">${escapeHtml(template?.name ?? "Sin plantilla")}</span>
              <span class="meta-chip">${escapeHtml(totalMinutes(product.areaMinutes))} min estimados</span>
              <span class="meta-chip">${escapeHtml(product.materials.length)} materiales</span>
              <span class="meta-chip">${escapeHtml(product.documents.length)} documentos</span>
            </div>
          </div>
          <div class="profile-actions">
            <button class="history-button tiny" data-action="edit" type="button">Editar</button>
            <button class="danger-button tiny" data-action="delete" type="button">Borrar</button>
          </div>
        </div>
        <div class="product-detail-grid">
          <div>
            <p class="eyebrow muted">Materiales</p>
            ${renderMaterialList(product.materials)}
          </div>
          <div>
            <p class="eyebrow muted">Tiempos por area</p>
            ${renderAreaMinuteList(product.areaMinutes)}
          </div>
        </div>
        ${product.documents.length ? `
          <div class="product-documents">
            <p class="eyebrow muted">Documentos tecnicos</p>
            ${renderDocumentLinks(product.documents)}
          </div>
        ` : ""}
      `;
      card.querySelector('[data-action="edit"]').addEventListener("click", () => openProductEditor(product.id));
      card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteProductBase(product.id));
        cards.appendChild(card);
      });
      familyList.appendChild(familySection);
    });
    productList.appendChild(categorySection);
  });
}

function openProductEditor(productId = null) {
  const product = getProduct(productId);
  editingProductId = productId;
  productDialogTitle.textContent = product ? "Editar producto" : "Nuevo producto";
  productNameInput.value = product?.name ?? "";
  renderClassificationOptions(productCategoryExistingSelect, productCategoryInput, "category", product?.category ?? "", "tipo");
  renderExistingFamilyOptions(product?.family ?? "");
  renderClassificationOptions(productVariantExistingSelect, productVariantInput, "variant", product?.variant ?? "", "variante");
  renderProductTemplateOptions(product?.templateId);
  editingProductMaterials = structuredClone(product?.materials ?? [materialRow("", "", "")]);
  editingProductTimes = Object.entries(product?.areaMinutes ?? {})
    .map(([area, minutes]) => ({ area, minutes }))
    .filter((item) => item.area);
  if (editingProductTimes.length === 0) {
    editingProductTimes = [{ area: state.areas[0] ?? "Diseno", minutes: 60 }];
  }
  editingProductDocuments = structuredClone(product?.documents ?? []);
  renderProductMaterialEditor();
  renderProductTimeEditor();
  renderProductDocumentEditor();
  productDialog.showModal();
  productNameInput.focus();
}

function renderClassificationOptions(select, input, field, selectedValue, noun) {
  const values = uniqueCatalogValues(state.products, field);
  const exists = values.includes(selectedValue);
  select.innerHTML = `
    <option value="">Sin ${noun}</option>
    ${values.map(optionHtml).join("")}
    <option value="__new__">+ Crear ${noun}</option>
  `;
  select.value = exists || !selectedValue ? selectedValue : "__new__";
  input.value = exists ? "" : selectedValue;
  input.classList.toggle("is-hidden", select.value !== "__new__");
}

function handleClassificationSelection(select, input) {
  const creatingNew = select.value === "__new__";
  input.classList.toggle("is-hidden", !creatingNew);
  if (creatingNew) {
    input.value = "";
    input.focus();
  }
}

function renderExistingFamilyOptions(selectedFamily = "") {
  const families = [...new Set(state.products.map((item) => item.family).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
  const exists = families.includes(selectedFamily);
  productFamilyExistingSelect.innerHTML = `
    <option value="">Sin familia</option>
    ${families.map((family) => `<option value="${escapeHtml(family)}">${escapeHtml(family)}</option>`).join("")}
    <option value="__new__">+ Crear nueva familia</option>
  `;
  productFamilyExistingSelect.value = exists || !selectedFamily ? selectedFamily : "__new__";
  productFamilyInput.value = exists ? "" : selectedFamily;
  productFamilyInput.classList.toggle("is-hidden", productFamilyExistingSelect.value !== "__new__");
}

function handleExistingFamilySelection() {
  handleClassificationSelection(productFamilyExistingSelect, productFamilyInput);
}

function renderProductTemplateOptions(selectedId = productTemplateSelect.value) {
  productTemplateSelect.innerHTML = state.templates
    .map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.name)}</option>`)
    .join("");
  if (state.templates.some((template) => template.id === selectedId)) productTemplateSelect.value = selectedId;
}

function renderProductMaterialEditor() {
  productMaterialsTable.innerHTML = `
    <div class="material-table-head">
      <span>Cantidad</span>
      <span>Unidad</span>
      <span>Material</span>
      <span></span>
    </div>
  `;
  editingProductMaterials.forEach((material, index) => {
    const row = document.createElement("div");
    row.className = "material-row";
    row.innerHTML = `
      <input data-field="quantity" type="number" min="0" step="0.01" placeholder="3" value="${escapeHtml(material.quantity)}" />
      <input data-field="unit" type="text" placeholder="hojas" value="${escapeHtml(material.unit)}" />
      <input data-field="name" type="text" placeholder="Triplay pino" value="${escapeHtml(material.name)}" />
      <button class="danger-button tiny" type="button">Quitar</button>
    `;
    row.querySelector('[data-field="quantity"]').addEventListener("input", (event) => {
      material.quantity = event.target.value;
    });
    row.querySelector('[data-field="unit"]').addEventListener("input", (event) => {
      material.unit = event.target.value;
    });
    row.querySelector('[data-field="name"]').addEventListener("input", (event) => {
      material.name = event.target.value;
    });
    row.querySelector("button").addEventListener("click", () => {
      editingProductMaterials.splice(index, 1);
      renderProductMaterialEditor();
    });
    productMaterialsTable.appendChild(row);
  });
}

function renderProductTimeEditor() {
  productTimeList.innerHTML = "";
  editingProductTimes.forEach((time, index) => {
    const row = document.createElement("div");
    row.className = "product-time-row";
    row.innerHTML = `
      <select data-field="area">
        ${state.areas.map((area) => `<option value="${escapeHtml(area)}" ${area === time.area ? "selected" : ""}>${escapeHtml(area)}</option>`).join("")}
      </select>
      <input data-field="minutes" type="number" min="0" step="1" placeholder="60" value="${escapeHtml(time.minutes)}" />
      <button class="danger-button tiny" type="button">Quitar</button>
    `;
    row.querySelector('[data-field="area"]').addEventListener("change", (event) => {
      time.area = event.target.value;
    });
    row.querySelector('[data-field="minutes"]').addEventListener("input", (event) => {
      time.minutes = Number(event.target.value) || 0;
    });
    row.querySelector("button").addEventListener("click", () => {
      editingProductTimes.splice(index, 1);
      renderProductTimeEditor();
    });
    productTimeList.appendChild(row);
  });
}

function renderProductDocumentEditor() {
  productDocumentList.innerHTML = "";
  if (editingProductDocuments.length === 0) {
    productDocumentList.innerHTML = `<p class="muted-text">Todavia no hay documentos.</p>`;
    return;
  }
  editingProductDocuments.forEach((documentItem, index) => {
    const row = document.createElement("div");
    row.className = "product-document-row";
    row.innerHTML = `
      <input data-field="title" type="text" placeholder="Ej. Plano de armado" value="${escapeHtml(documentItem.title)}" />
      <input data-field="url" type="url" placeholder="https://..." value="${escapeHtml(documentItem.url)}" />
      <button class="danger-button tiny" type="button">Quitar</button>
    `;
    row.querySelector('[data-field="title"]').addEventListener("input", (event) => {
      documentItem.title = event.target.value;
    });
    row.querySelector('[data-field="url"]').addEventListener("input", (event) => {
      documentItem.url = event.target.value;
    });
    row.querySelector("button").addEventListener("click", () => {
      editingProductDocuments.splice(index, 1);
      renderProductDocumentEditor();
    });
    productDocumentList.appendChild(row);
  });
}

function saveProductFromEditor() {
  const name = productNameInput.value.trim();
  if (!name) return;
  const family = productFamilyExistingSelect.value === "__new__"
    ? productFamilyInput.value.trim()
    : productFamilyExistingSelect.value;
  const category = productCategoryExistingSelect.value === "__new__"
    ? productCategoryInput.value.trim()
    : productCategoryExistingSelect.value;
  const variant = productVariantExistingSelect.value === "__new__"
    ? productVariantInput.value.trim()
    : productVariantExistingSelect.value;
  const areaMinutes = {};
  editingProductTimes.forEach((item) => {
    if (!item.area) return;
    const minutes = Math.max(0, Math.round(Number(item.minutes) || 0));
    if (minutes > 0) areaMinutes[item.area] = minutes;
  });
  const product = {
    id: editingProductId ?? createUuid(),
    name,
    category,
    family,
    variant,
    templateId: productTemplateSelect.value,
    materials: normalizeMaterialRows(editingProductMaterials),
    areaMinutes,
    documents: normalizeProductDocuments(editingProductDocuments)
  };
  const index = state.products.findIndex((item) => item.id === product.id);
  if (index >= 0) state.products[index] = product;
  else state.products.push(product);
  saveState();
  productDialog.close();
  renderAll();
}

function deleteProductBase(productId) {
  const product = getProduct(productId);
  if (!product) return;
  const used = state.projects.some((project) => project.productId === productId);
  const warning = used ? " Ya hay proyectos creados con este producto; no se borraran, solo perderan el enlace al producto base." : "";
  if (!confirm(`Borrar el producto "${product.name}"?${warning}`)) return;
  state.products = state.products.filter((item) => item.id !== productId);
  state.projects.forEach((project) => {
    if (project.productId === productId) project.productId = null;
  });
  saveState();
  renderAll();
}

function renderAdminProjects() {
  adminProjects.innerHTML = "";
  const query = normalizeSearch(adminSearchInput.value);
  const activeProjects = state.projects
    .filter((project) => !project.completedAt && projectMatchesSearch(project, query))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const completedProjects = state.projects
    .filter((project) => project.completedAt && !project.archivedAt && projectMatchesSearch(project, query))
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  adminVisibleProjectIds = [...activeProjects, ...completedProjects].map((project) => project.id);
  adminVisibleCompletedIds = completedProjects.map((project) => project.id);
  [...adminProjectSelection].forEach((projectId) => {
    if (!state.projects.some((project) => project.id === projectId && !project.archivedAt)) {
      adminProjectSelection.delete(projectId);
    }
  });

  renderNotificationList(adminProjects, query);

  if (activeProjects.length === 0 && completedProjects.length === 0) {
    if (!adminProjects.innerHTML) {
      adminProjects.innerHTML = `<div class="empty-state">${query ? "No se encontraron resultados." : "No hay proyectos activos o completados."}</div>`;
    }
    updateAdminProjectBatchControls();
    return;
  }

  renderProjectGroup("Activos", activeProjects, "active", adminProjects);
  renderProjectGroup("Completados", completedProjects, "ready", adminProjects);
  updateAdminProjectBatchControls();
}

function renderArchive() {
  archiveContent.innerHTML = "";
  const query = normalizeSearch(archiveSearchInput.value);
  const archivedNotifications = (state.notifications ?? [])
    .filter((item) => item.archivedAt && notificationMatchesSearch(item, query))
    .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  const archivedProjects = state.projects
    .filter((project) => project.archivedAt && projectMatchesSearch(project, query))
    .sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
  archiveVisibleKeys = [
    ...archivedNotifications.map((item) => `notification:${item.id}`),
    ...archivedProjects.map((project) => `project:${project.id}`)
  ];

  if (archivedNotifications.length > 0) {
    archiveContent.appendChild(renderArchivedNotifications(archivedNotifications));
  }
  if (archivedProjects.length > 0) {
    const group = document.createElement("section");
    group.className = "project-admin-group archived-records";
    group.innerHTML = `<p class="eyebrow muted">Pedidos archivados</p>`;
    archivedProjects.forEach((project) => {
      group.appendChild(renderAdminProjectCard(project, "archived", true));
    });
    archiveContent.appendChild(group);
  }
  if (archivedNotifications.length === 0 && archivedProjects.length === 0) {
    archiveContent.innerHTML = `<div class="empty-state">${query ? "No se encontraron resultados en el archivo." : "El archivo esta vacio."}</div>`;
  }
  updateArchiveActionState();
}

function renderCalendar() {
  const query = normalizeSearch(calendarSearchInput.value);
  const projects = state.projects
    .filter((project) => (showArchivedInCalendar || !project.archivedAt) && projectMatchesSearch(project, query))
    .sort((a, b) => calendarSortValue(a) - calendarSortValue(b));
  const lateCount = projects.filter((project) => getScheduleStatus(project).type === "late").length;
  const dueTodayCount = projects.filter((project) => getScheduleStatus(project).type === "today").length;
  const completedCount = projects.filter((project) => project.completedAt).length;

  calendarSummary.innerHTML = `
    <article class="calendar-stat late"><strong>${lateCount}</strong><span>Atrasados</span></article>
    <article class="calendar-stat today"><strong>${dueTodayCount}</strong><span>Para hoy</span></article>
    <article class="calendar-stat done"><strong>${completedCount}</strong><span>Completados</span></article>
  `;

  renderCalendarGrid(projects);
  renderCalendarNoDateList(projects);
}

function changeCalendarMonth(delta) {
  calendarMonthDate = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + delta, 1);
  renderCalendar();
}

function renderCalendarGrid(projects) {
  const monthStart = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth(), 1);
  const monthEnd = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - ((monthStart.getDay() + 6) % 7));
  const dayNames = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const scheduledProjects = projects.filter((project) => project.startDate && project.dueDate);

  calendarMonthLabel.textContent = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric"
  }).format(monthStart);

  calendarGrid.innerHTML = `
    ${dayNames.map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}
    ${Array.from({ length: 6 }, (_, weekIndex) => {
      const weekDays = days.slice(weekIndex * 7, weekIndex * 7 + 7);
      return renderCalendarWeek(weekDays, monthStart, scheduledProjects);
    }).join("")}
  `;
  calendarGrid.querySelectorAll("[data-calendar-project-id]").forEach((bar) => {
    bar.addEventListener("click", () => showProjectDetails(bar.dataset.calendarProjectId));
  });
  calendarGrid.querySelectorAll("[data-calendar-week-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const weekKey = button.dataset.calendarWeekKey;
      if (expandedCalendarWeeks.has(weekKey)) expandedCalendarWeeks.delete(weekKey);
      else expandedCalendarWeeks.add(weekKey);
      renderCalendar();
    });
  });
}

function renderCalendarWeek(days, monthStart, projects) {
  const today = dateOnly(new Date());
  const weekStart = dateOnly(days[0]);
  const weekEnd = dateOnly(days[6]);
  const expanded = expandedCalendarWeeks.has(weekStart);
  const segments = projects
    .filter((project) => project.startDate <= weekEnd && project.dueDate >= weekStart)
    .map((project) => ({
      project,
      startColumn: Math.max(0, days.findIndex((day) => dateOnly(day) >= project.startDate)),
      endColumn: (() => {
        const firstAfter = days.findIndex((day) => dateOnly(day) > project.dueDate);
        return firstAfter === -1 ? 6 : firstAfter - 1;
      })()
    }))
    .sort((a, b) => a.startColumn - b.startColumn || b.endColumn - a.endColumn);

  const laneEnds = [];
  segments.forEach((segment) => {
    let lane = laneEnds.findIndex((endColumn) => endColumn < segment.startColumn);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = segment.endColumn;
    segment.lane = lane;
  });

  const visibleLanes = expanded ? laneEnds.length : Math.min(laneEnds.length, 4);
  const weekHeight = 54 + visibleLanes * 31 + (laneEnds.length > 4 ? 28 : 0);
  return `
    <div class="calendar-week" style="min-height:${weekHeight}px">
      ${days.map((day) => {
        const key = dateOnly(day);
        const inMonth = day.getMonth() === monthStart.getMonth();
        return `
          <div class="calendar-day ${inMonth ? "" : "outside"} ${key === today ? "today" : ""}">
            <div class="calendar-day-number">${day.getDate()}</div>
          </div>
        `;
      }).join("")}
      <div class="calendar-week-events">
        ${segments.filter((segment) => segment.lane < visibleLanes).map(renderCalendarSegment).join("")}
        ${laneEnds.length > 4 ? `
          <button
            class="calendar-more"
            style="--more-lane:${visibleLanes}"
            data-calendar-week-key="${weekStart}"
            type="button"
          >${expanded ? "Mostrar menos" : `+ ${laneEnds.length - 4} ${laneEnds.length - 4 === 1 ? "pedido mas" : "pedidos mas"}`}</button>
        ` : ""}
      </div>
    </div>
  `;
}

function renderCalendarSegment(segment) {
  const { project, startColumn, endColumn, lane } = segment;
  const status = getScheduleStatus(project);
  const color = calendarColorForProject(project);
  const activeNames = getActiveNodes(project).map((node) => node.area).join(" + ") || "Terminado";
  const label = project.folio ? `${project.folio} - ${project.name}` : project.name;
  return `
    <button
      type="button"
      class="calendar-bar ${status.type} ${project.archivedAt ? "archived" : ""}"
      style="--start:${startColumn}; --span:${endColumn - startColumn + 1}; --lane:${lane}; --calendar-bg:${color.background}; --calendar-text:${color.text}; --calendar-border:${color.border}"
      data-calendar-project-id="${escapeHtml(project.id)}"
      title="${escapeHtml(project.name)} - ${escapeHtml(activeNames)}"
    >
      <strong>${escapeHtml(label)}</strong>
    </button>
  `;
}

function calendarColorForProject(project) {
  const source = String(project.id || project.folio || project.name);
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    background: `hsl(${hue} 55% 86%)`,
    text: `hsl(${hue} 52% 23%)`,
    border: `hsl(${hue} 42% 48%)`
  };
}

function renderCalendarNoDateList(projects) {
  const noDateProjects = projects.filter((project) => !project.startDate || !project.dueDate);
  calendarList.innerHTML = "";
  if (projects.length === 0) {
    calendarList.innerHTML = `<div class="empty-state">${calendarSearchInput.value ? "No se encontraron proyectos en calendario." : "Todavia no hay proyectos con fechas para mostrar."}</div>`;
    return;
  }
  if (noDateProjects.length === 0) return;
  const group = document.createElement("section");
  group.className = "calendar-day-group";
  group.innerHTML = `
    <div class="calendar-day-head">
      <strong>Entrega pendiente de definir</strong>
      <span>${noDateProjects.length} ${noDateProjects.length === 1 ? "proyecto" : "proyectos"}</span>
    </div>
    <div class="calendar-day-list"></div>
  `;
  const list = group.querySelector(".calendar-day-list");
  noDateProjects.forEach((project) => list.appendChild(renderCalendarCard(project)));
  calendarList.appendChild(group);
}

function renderCalendarCard(project) {
  const status = getScheduleStatus(project);
  const activeNames = getActiveNodes(project).map((node) => node.area).join(" + ") || "Terminado";
  const product = getProduct(project.productId);
  const card = document.createElement("article");
  card.className = `calendar-card ${status.type} ${project.archivedAt ? "archived" : ""}`;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.innerHTML = `
    <div>
      <h3>${escapeHtml(project.name)}</h3>
      <div class="project-meta">
        <span class="meta-chip folio-chip ${project.folio ? "" : "is-empty"}">${project.folio ? `Folio: ${escapeHtml(project.folio)}` : "Sin folio"}</span>
        <span class="meta-chip">${escapeHtml(product?.name ?? "Sin producto base")}</span>
        <span class="meta-chip">Estado: ${escapeHtml(project.completedAt ? "Completado" : activeNames)}</span>
      </div>
    </div>
    <div class="calendar-status">
      <strong>${escapeHtml(status.label)}</strong>
      <span>${escapeHtml(scheduleDateText(project))}</span>
      ${project.dueDate ? "" : `<button class="small-button assign-date-button" type="button">Definir entrega</button>`}
    </div>
  `;
  card.addEventListener("click", () => showProjectDetails(project.id));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") showProjectDetails(project.id);
  });
  card.querySelector(".assign-date-button")?.addEventListener("click", (event) => {
    event.stopPropagation();
    openProjectEditor(project.id);
  });
  return card;
}

function groupProjectsByDate(projects) {
  const groups = new Map();
  projects.forEach((project) => {
    const key = project.dueDate || "sin-fecha";
    const label = project.dueDate ? formatPlainDate(project.dueDate) : "Sin fecha de entrega";
    if (!groups.has(key)) groups.set(key, { key, label, projects: [] });
    groups.get(key).projects.push(project);
  });
  return [...groups.values()].sort((a, b) => {
    if (a.key === "sin-fecha") return 1;
    if (b.key === "sin-fecha") return -1;
    return new Date(a.key) - new Date(b.key);
  });
}

function renderProjectGroup(title, projects, groupType, container) {
  if (projects.length === 0) return;
  const group = document.createElement("section");
  group.className = `project-admin-group ${groupType}`;
  group.innerHTML = `<p class="eyebrow muted">${escapeHtml(title)}</p>`;

  groupProjectsByFolio(projects).forEach(({ folio, projects: folioProjects }) => {
    const folioGroup = document.createElement("section");
    folioGroup.className = `folio-project-group ${folio ? "" : "without-folio"}`;
    folioGroup.innerHTML = `
      <div class="folio-group-heading">
        <div>
          <span>Folio</span>
          <strong>${escapeHtml(folio || "Sin folio")}</strong>
        </div>
        <span>${folioProjects.length} ${folioProjects.length === 1 ? "proyecto" : "proyectos"}</span>
      </div>
      <div class="folio-project-list"></div>
    `;
    const list = folioGroup.querySelector(".folio-project-list");
    folioProjects.forEach((project) => {
      list.appendChild(renderAdminProjectCard(project, groupType));
    });
    group.appendChild(folioGroup);
  });
  container.appendChild(group);
}

function groupProjectsByFolio(projects) {
  const groups = new Map();
  projects.forEach((project) => {
    const folio = String(project.folio ?? "").trim();
    const key = folio ? normalizeSearch(folio) : "__sin_folio__";
    if (!groups.has(key)) groups.set(key, { folio, projects: [] });
    groups.get(key).projects.push(project);
  });
  return [...groups.values()].sort((a, b) => {
    if (!a.folio) return 1;
    if (!b.folio) return -1;
    return a.folio.localeCompare(b.folio, "es", { numeric: true });
  });
}

function renderAdminProjectCard(project, groupType, selectable = false) {
  const template = getTemplate(project);
  const product = getProduct(project.productId);
  const activeNodes = getActiveNodes(project);
  const activeNames = activeNodes.map((node) => node.area).join(" + ") || "Terminado";
  const activeBlocks = Object.values(project.blockedNodes ?? {});
  const readyText = project.completedAt ? readyArchiveText(project) : "";
  const schedule = getScheduleStatus(project);
  const statusText = groupType === "archived"
    ? "Archivado"
    : project.completedAt
      ? "Completado"
      : activeBlocks.length
        ? `Bloqueado: ${activeBlocks.map((block) => block.area).join(" + ")}`
        : activeNames;
  const projectActions = groupType === "archived"
    ? `<button class="history-button unarchive-project-button" type="button">Desarchivar</button>`
    : project.completedAt
      ? `<button class="return-button compact reopen-project-button" type="button">Reabrir proceso</button>
         <button class="primary-button archive-project-button" type="button">Archivar</button>`
      : "";
  const card = document.createElement("article");
  card.className = `admin-project-card ${groupType}`;
  card.innerHTML = `
    <div class="admin-project-top">
      <div>
        ${selectable ? `<label class="archive-select"><input type="checkbox" data-archive-key="project:${escapeHtml(project.id)}" /> Seleccionar</label>` : ""}
        ${["active", "ready"].includes(groupType) ? `<label class="archive-select project-batch-select"><input type="checkbox" data-admin-project-id="${escapeHtml(project.id)}" /> Seleccionar</label>` : ""}
        <h3>${escapeHtml(project.name)}</h3>
        <div class="project-meta">
          ${project.folio
            ? `<button class="meta-chip folio-chip interactive-chip" data-action="folio-details" type="button">Folio: ${escapeHtml(project.folio)}</button>`
            : `<span class="meta-chip folio-chip is-empty">Sin folio</span>`}
          ${product ? `<button class="meta-chip strong-chip interactive-chip" data-action="product-details" type="button">${escapeHtml(product.name)}</button>` : ""}
          <span class="meta-chip">Estado: ${escapeHtml(statusText)}</span>
          ${project.startDate ? `<span class="meta-chip">Inicio: ${escapeHtml(formatPlainDate(project.startDate))}</span>` : ""}
          ${project.dueDate ? `<span class="meta-chip ${schedule.type === "late" ? "late-chip" : ""}">Entrega: ${escapeHtml(formatPlainDate(project.dueDate))}</span>` : ""}
          <span class="meta-chip">${escapeHtml(project.completedAt ? readyText : `Tiempo en etapa: ${longestActiveTime(project)}`)}</span>
          ${schedule.type === "late" ? `<span class="meta-chip late-chip">${escapeHtml(schedule.label)}</span>` : ""}
        </div>
      </div>
      <span class="status-pill">${escapeHtml(statusText)}</span>
    </div>
    ${renderProjectPlanningSummary(project)}
    <div class="project-tree-wrap">${renderFlowTree(template, project)}</div>
    <div class="admin-project-actions">
      <button class="history-button show-history-button" type="button">Ver historial</button>
      <button class="history-button edit-project-button" type="button">Editar</button>
      ${projectActions}
      <button class="danger-button" type="button">Borrar</button>
    </div>
  `;
  card.querySelector(".show-history-button").addEventListener("click", () => showHistory(project.id));
  card.querySelector(".edit-project-button").addEventListener("click", () => openProjectEditor(project.id));
  card.querySelector('[data-action="product-details"]')?.addEventListener("click", () => showCatalogProductDetails(product.id));
  card.querySelector('[data-action="folio-details"]')?.addEventListener("click", () => showFolioDetails(project.folio));
  card.querySelector(".danger-button").addEventListener("click", () => deleteProject(project.id));
  card.querySelector(".archive-project-button")?.addEventListener("click", () => archiveProject(project.id));
  card.querySelector(".unarchive-project-button")?.addEventListener("click", () => unarchiveProject(project.id));
  card.querySelector(".reopen-project-button")?.addEventListener("click", () => openReopenDialog(project.id));
  const checkbox = card.querySelector("[data-archive-key]");
  if (checkbox) bindArchiveCheckbox(checkbox);
  const adminCheckbox = card.querySelector("[data-admin-project-id]");
  if (adminCheckbox) bindAdminProjectCheckbox(adminCheckbox);
  return card;
}

function renderNodeBadge(project, node) {
  const done = isNodeDone(project, node.id);
  const active = project.activeNodeIds.includes(node.id) && !project.completedAt;
  const color = done ? "background:#e7f3eb;color:#24573d;" : active ? "background:#fff1d8;color:#82510f;" : "";
  return `<span class="step-badge" style="${color}">${escapeHtml(done ? "OK " : active ? "Ahora " : "")}${escapeHtml(node.area)}</span>`;
}

function renderProjectPlanningSummary(project) {
  const materials = project.materials ?? [];
  const minutes = project.estimatedMinutesByArea ?? {};
  if (materials.length === 0 && Object.keys(minutes).length === 0) return "";
  return `
    <div class="project-planning-summary">
      ${materials.length > 0 ? `
        <div>
          <p class="eyebrow muted">Materiales</p>
          ${renderMaterialList(materials, 4)}
        </div>
      ` : ""}
      ${Object.keys(minutes).length > 0 ? `
        <div>
          <p class="eyebrow muted">Estimado</p>
          <p class="planning-total"><strong>Total: ${escapeHtml(totalMinutes(minutes))} min</strong> · ${escapeHtml(formatMinutesAsHours(totalMinutes(minutes)))}</p>
          ${renderAreaMinuteList(minutes, 5)}
        </div>
      ` : ""}
    </div>
  `;
}

function formatMinutesAsHours(minutes) {
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

function formatEstimatedDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  return formatMinutesAsHours(minutes);
}

function renderFlowTree(template, project = null) {
  const layout = createDiagramLayout(template);
  const markerId = `arrow-${template.id}-${project?.id ?? "template"}`.replace(/[^a-zA-Z0-9_-]/g, "");
  return `
    <div class="flow-tree" style="width:${layout.width}px;height:${layout.height}px;">
      <svg class="diagram-svg" viewBox="0 0 ${layout.width} ${layout.height}" aria-hidden="true">
        <defs>
          <marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z"></path>
          </marker>
        </defs>
        ${layout.edges.map((edge) => renderDiagramEdge(edge, markerId)).join("")}
      </svg>
      ${layout.nodes.map((item) => renderDiagramNode(template, item.node, project, item.x, item.y)).join("")}
    </div>
  `;
}

function createDiagramLayout(template) {
  const nodeWidth = 154;
  const nodeHeight = 124;
  const columnGap = 86;
  const rowGap = 18;
  const padding = 8;
  const levels = getTemplateLevels(template);
  const positions = new Map();
  const nodes = [];

  levels.forEach((level, levelIndex) => {
    level.forEach((node, rowIndex) => {
      const x = padding + levelIndex * (nodeWidth + columnGap);
      const y = padding + rowIndex * (nodeHeight + rowGap);
      positions.set(node.id, { x, y, levelIndex, rowIndex });
      nodes.push({ node, x, y });
    });
  });

  const maxRows = Math.max(...levels.map((level) => level.length), 1);
  const width = padding * 2 + levels.length * nodeWidth + Math.max(0, levels.length - 1) * columnGap;
  const height = padding * 2 + maxRows * nodeHeight + Math.max(0, maxRows - 1) * rowGap;
  const edges = [];

  template.nodes.forEach((node) => {
    const from = positions.get(node.id);
    if (!from) return;
    node.nextIds.forEach((nextId) => {
      const to = positions.get(nextId);
      if (!to) return;
      edges.push({
        x1: from.x + nodeWidth,
        y1: from.y + nodeHeight / 2,
        x2: to.x,
        y2: to.y + nodeHeight / 2
      });
    });
  });

  return { edges, height, nodes, width };
}

function renderDiagramEdge(edge, markerId) {
  const handle = Math.max(28, Math.min(58, (edge.x2 - edge.x1) / 2));
  const d = `M ${edge.x1} ${edge.y1} C ${edge.x1 + handle} ${edge.y1}, ${edge.x2 - handle} ${edge.y2}, ${edge.x2} ${edge.y2}`;
  return `
    <path class="diagram-line" d="${d}" marker-end="url(#${markerId})"></path>
  `;
}

function renderDiagramNode(template, node, project, x, y) {
  const incoming = template.nodes.filter((candidate) => candidate.nextIds.includes(node.id));
  const nextNodes = node.nextIds.map((nodeId) => getNode(template, nodeId)).filter(Boolean);
  const stateClass = project ? getNodeStateClass(project, node) : "";
  const stateLabel = project ? getNodeStateLabel(project, node) : "";
  const waitsFor = incoming.length > 1 ? `<span class="tree-note">Espera ${incoming.length} entradas</span>` : "";
  const retryAreas = project
    ? (project.retryTargetsByNode?.[node.id] ?? []).map((nextId) => getNode(template, nextId)?.area).filter(Boolean)
    : [];
  const sendsTo = retryAreas.length
    ? `<span class="tree-note tree-retry-note">Reenvia solo a ${escapeHtml(retryAreas.join(" + "))}</span>`
    : nextNodes.length
      ? `<span class="tree-note">Manda a ${escapeHtml(nextNodes.map((next) => next.area).join(" + "))}</span>`
      : `<span class="tree-note">Final</span>`;
  const assignedUsers = project ? getAssignedUsers(project, node.id) : [];
  return `
    <div class="tree-node diagram-node ${stateClass}" style="left:${x}px;top:${y}px;">
      <strong>${escapeHtml(node.area)}</strong>
      ${stateLabel ? `<span class="tree-state">${stateLabel}</span>` : ""}
      ${project ? `<span class="tree-assignee">${assignedUsers.length ? escapeHtml(formatAssignedUsers(assignedUsers)) : "Toda el area"}</span>` : ""}
      ${waitsFor}
      ${sendsTo}
    </div>
  `;
}

function getTemplateLevels(template) {
  const depthById = new Map();
  getStartNodes(template).forEach((node) => depthById.set(node.id, 0));
  let changed = true;
  let guard = 0;

  while (changed && guard < template.nodes.length * template.nodes.length) {
    changed = false;
    guard += 1;
    template.nodes.forEach((node) => {
      const depth = depthById.get(node.id);
      if (depth === undefined) return;
      node.nextIds.forEach((nextId) => {
        const nextDepth = depth + 1;
        if ((depthById.get(nextId) ?? -1) < nextDepth) {
          depthById.set(nextId, nextDepth);
          changed = true;
        }
      });
    });
  }

  template.nodes.forEach((node) => {
    if (!depthById.has(node.id)) depthById.set(node.id, 0);
  });

  const maxDepth = Math.max(...depthById.values(), 0);
  return Array.from({ length: maxDepth + 1 }, (_, depth) =>
    template.nodes.filter((node) => depthById.get(node.id) === depth)
  ).filter((level) => level.length > 0);
}

function getNodeStateClass(project, node) {
  if (isNodeDone(project, node.id)) return "is-done";
  if (project.blockedNodes?.[node.id]) return "is-blocked";
  if (project.activeNodeIds.includes(node.id) && !project.completedAt) return "is-active";
  return "is-waiting";
}

function getNodeStateLabel(project, node) {
  if (isNodeDone(project, node.id)) return "OK";
  if (project.blockedNodes?.[node.id]) return "Bloqueado";
  if (project.activeNodeIds.includes(node.id) && !project.completedAt) return "Ahora";
  return "Pendiente";
}

function finishNode(projectId, nodeId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project || project.completedAt || !project.activeNodeIds.includes(nodeId) || project.blockedNodes?.[nodeId]) return;
  const template = getTemplate(project);
  const node = getNode(template, nodeId);
  const mayWorkNode = hasAdminAccess(currentUser)
    || (currentUser?.area === node?.area && isNodeAssignedToUser(project, node, currentUser));
  if (!node || !mayWorkNode) return;

  getOpenIncomingHandoffs(project, nodeId).forEach((handoff) => {
    handoff.status = "cleared";
    handoff.acceptedAt = new Date().toISOString();
    handoff.acceptedBy = currentUser.name;
  });

  project.history.push({
    nodeId,
    area: node.area,
    step: node.area,
    user: currentUser.name,
    completedAt: new Date().toISOString()
  });
  project.activeNodeIds = project.activeNodeIds.filter((id) => id !== nodeId);
  delete project.nodeStartedAt[nodeId];

  const retryTargets = new Set(project.retryTargetsByNode?.[nodeId] ?? []);
  const nextIdsToActivate = retryTargets.size > 0
    ? node.nextIds.filter((nextId) => retryTargets.has(nextId))
    : node.nextIds;
  const unresolvedRetryTargets = [];

  nextIdsToActivate.forEach((nextId) => {
    if (project.activeNodeIds.includes(nextId) || isNodeDone(project, nextId)) return;
    if (!allPreviousDone(template, project, nextId)) {
      if (retryTargets.has(nextId)) unresolvedRetryTargets.push(nextId);
      return;
    }
    project.activeNodeIds.push(nextId);
    project.nodeStartedAt[nextId] = new Date().toISOString();
    createHandoff(project, node, getNode(template, nextId));
  });
  if (retryTargets.size > 0) {
    project.retryTargetsByNode = project.retryTargetsByNode ?? {};
    if (unresolvedRetryTargets.length > 0) project.retryTargetsByNode[nodeId] = unresolvedRetryTargets;
    else delete project.retryTargetsByNode[nodeId];
  }

  if (project.activeNodeIds.length === 0) {
    project.completedAt = new Date().toISOString();
  }

  saveState();
  renderAll();
}

function createHandoff(project, fromNode, toNode) {
  if (!toNode) return;
  project.handoffs = project.handoffs ?? [];
  project.handoffs.push({
    id: createUuid(),
    fromNodeId: fromNode.id,
    fromArea: fromNode.area,
    toNodeId: toNode.id,
    toArea: toNode.area,
    completedAt: new Date().toISOString(),
    completedBy: currentUser.name,
    status: "open"
  });
  createProductionNotification({
    project,
    fromArea: fromNode.area,
    toArea: toNode.area,
    toUserIds: project.assignments?.[toNode.id] ?? [],
    comment: `${fromNode.area} termino. El pedido ya esta disponible en ${toNode.area}.`,
    type: "process-arrival"
  });
}

function createNewProjectNotifications(project) {
  const template = getTemplate(project);
  getStartNodes(template).forEach((node) => {
    createProductionNotification({
      project,
      fromArea: "Administracion",
      toArea: node.area,
      toUserIds: project.assignments?.[node.id] ?? [],
      comment: `Nuevo pedido listo para iniciar en ${node.area}.`,
      type: "new-project"
    });
  });
}

function createProductionNotification({ project, fromArea, toArea, toUserIds = [], comment, type }) {
  state.notifications = state.notifications ?? [];
  state.notifications.unshift({
    id: createUuid(),
    projectId: project.id,
    projectName: project.name,
    fromArea,
    toArea,
    toUserIds: [...new Set(toUserIds)],
    comment,
    createdAt: new Date().toISOString(),
    createdBy: currentUser?.name ?? "Sistema",
    type
  });
}

function openBlockDialog(projectId, nodeId) {
  const project = state.projects.find((item) => item.id === projectId);
  const node = project ? getNode(getTemplate(project), nodeId) : null;
  if (!project || !node || currentUser?.area !== node.area || !isNodeAssignedToUser(project, node, currentUser) || project.blockedNodes?.[nodeId]) return;
  blockRequest = { projectId, nodeId };
  blockProjectText.textContent = `${project.name} · ${node.area}${project.folio ? ` · Folio ${project.folio}` : ""}`;
  blockReasonInput.value = "";
  blockDialog.showModal();
}

function submitBlockRequest() {
  if (!blockRequest) return;
  const project = state.projects.find((item) => item.id === blockRequest.projectId);
  const node = project ? getNode(getTemplate(project), blockRequest.nodeId) : null;
  const reason = blockReasonInput.value.trim();
  if (!project || !node || !reason || currentUser?.area !== node.area || !isNodeAssignedToUser(project, node, currentUser)) return;

  const block = {
    id: createUuid(),
    nodeId: node.id,
    area: node.area,
    reason,
    blockedAt: new Date().toISOString(),
    blockedBy: currentUser.name
  };
  project.blockedNodes = project.blockedNodes ?? {};
  project.blockHistory = project.blockHistory ?? [];
  project.blockedNodes[node.id] = block;
  project.blockHistory.push(block);

  state.notifications = state.notifications ?? [];
  state.notifications.unshift({
    id: createUuid(),
    projectId: project.id,
    projectName: project.name,
    fromArea: node.area,
    toArea: "Administracion",
    comment: reason,
    createdAt: block.blockedAt,
    createdBy: currentUser.name,
    nodeId: node.id,
    blockId: block.id,
    type: "process-block"
  });

  blockRequest = null;
  blockDialog.close();
  saveState();
  renderAll();
}

function unlockProcess(notificationId) {
  if (!hasAdminAccess(currentUser)) return;
  const notification = (state.notifications ?? []).find((item) => item.id === notificationId);
  if (!notification) return;
  resolveProcessBlock(notification.projectId, notification.nodeId, notification.id);
}

function resolveProcessBlock(projectId, nodeId, notificationId = null) {
  const project = state.projects.find((item) => item.id === projectId);
  const block = project?.blockedNodes?.[nodeId];
  const mayUnlock = hasAdminAccess(currentUser) || currentUser?.area === block?.area;
  if (!project || !block || !mayUnlock) return;
  if (!confirm(`Desbloquear "${project.name}" en ${block.area}?`)) return;

  const resolvedAt = new Date().toISOString();
  const historyBlock = (project.blockHistory ?? []).find((item) => item.id === block.id);
  if (historyBlock) {
    historyBlock.resolvedAt = resolvedAt;
    historyBlock.resolvedBy = currentUser.name;
  }
  delete project.blockedNodes[nodeId];
  const relatedNotifications = (state.notifications ?? []).filter((item) =>
    item.type === "process-block"
    && item.projectId === projectId
    && item.nodeId === nodeId
    && (item.blockId === block.id || item.id === notificationId)
  );
  relatedNotifications.forEach((notification) => {
    notification.resolvedAt = resolvedAt;
    notification.resolvedBy = currentUser.name;
    notification.archivedAt = resolvedAt;
  });
  state.notifications.unshift({
    id: createUuid(),
    projectId: project.id,
    projectName: project.name,
    fromArea: currentUser.area,
    toArea: block.area,
    comment: `Proceso desbloqueado por ${currentUser.name}`,
    createdAt: resolvedAt,
    createdBy: currentUser.name,
    nodeId,
    type: "process-unlocked"
  });
  saveState();
  renderAll();
}

function openReturnDialog(projectId, nodeId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const template = getTemplate(project);
  const node = getNode(template, nodeId);
  const incoming = getOpenIncomingHandoffs(project, nodeId);
  if (!node || incoming.length === 0) return;

  returnRequest = { projectId, nodeId };
  returnProjectText.textContent = `${project.name} esta en ${node.area}. Elige que proceso debe corregirlo.`;
  returnTargetSelect.innerHTML = incoming.map((handoff) => `<option value="${handoff.id}">${escapeHtml(handoff.fromArea)}</option>`).join("");
  returnTargetSelect.closest("label").classList.toggle("is-hidden", incoming.length === 1);
  returnCommentInput.value = "";
  returnDialog.showModal();
  returnCommentInput.focus();
}

function submitReturnRequest() {
  if (!returnRequest) return;
  const comment = returnCommentInput.value.trim();
  if (!comment) return;
  returnToPreviousProcess(returnRequest.projectId, returnRequest.nodeId, returnTargetSelect.value, comment);
  returnRequest = null;
  returnDialog.close();
}

function openReopenDialog(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project?.completedAt) return;
  const template = getTemplate(project);
  reopenProjectId = projectId;
  reopenProjectText.textContent = `${project.name} fue devuelto por el cliente. Elige desde que proceso debe repetirse.`;
  reopenTargetSelect.innerHTML = template.nodes
    .filter((node) => isNodeDone(project, node.id))
    .map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.area)}</option>`)
    .join("");
  reopenTargetSelect.value = template.nodes.at(-1)?.id ?? "";
  reopenCommentInput.value = "";
  reopenDialog.showModal();
  reopenCommentInput.focus();
}

function submitReopenRequest() {
  if (!reopenProjectId) return;
  const comment = reopenCommentInput.value.trim();
  if (!comment || !reopenTargetSelect.value) return;
  reopenCompletedProject(reopenProjectId, reopenTargetSelect.value, comment);
  reopenProjectId = null;
  reopenDialog.close();
}

function reopenCompletedProject(projectId, nodeId, comment) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project?.completedAt) return;
  const template = getTemplate(project);
  const node = getNode(template, nodeId);
  if (!node) return;

  const reopenedAt = new Date().toISOString();
  const affectedNodeIds = getNodeAndDescendantIds(template, nodeId);
  project.history.forEach((entry) => {
    if (affectedNodeIds.has(entry.nodeId) && !entry.invalidatedAt) {
      entry.invalidatedAt = reopenedAt;
      entry.invalidatedReason = comment;
    }
  });
  (project.handoffs ?? []).forEach((handoff) => {
    if ((affectedNodeIds.has(handoff.fromNodeId) || affectedNodeIds.has(handoff.toNodeId))
      && ["open", "cleared"].includes(handoff.status)) {
      handoff.status = "superseded";
    }
  });

  project.reopenings = project.reopenings ?? [];
  project.reopenings.unshift({
    id: createUuid(),
    nodeId,
    area: node.area,
    comment,
    reopenedAt,
    reopenedBy: currentUser.name,
    previousCompletedAt: project.completedAt
  });
  project.completedAt = null;
  project.archivedAt = null;
  project.retryTargetsByNode = {};
  project.activeNodeIds = [nodeId];
  project.nodeStartedAt[nodeId] = reopenedAt;
  ensureActiveReturnHandoffs(project, template);

  state.notifications = state.notifications ?? [];
  state.notifications.unshift({
    id: createUuid(),
    projectId: project.id,
    projectName: project.name,
    fromArea: "Cliente",
    toArea: node.area,
    comment,
    createdAt: reopenedAt,
    createdBy: currentUser.name,
    type: "customer-return"
  });

  saveState();
  renderAll();
}

function getNodeAndDescendantIds(template, startNodeId) {
  const result = new Set();
  const pending = [startNodeId];
  while (pending.length > 0) {
    const currentId = pending.pop();
    if (result.has(currentId)) continue;
    result.add(currentId);
    const currentNode = getNode(template, currentId);
    currentNode?.nextIds.forEach((nextId) => pending.push(nextId));
  }
  return result;
}

function ensureActiveReturnHandoffs(project, template) {
  project.handoffs = project.handoffs ?? [];
  project.activeNodeIds.forEach((activeNodeId) => {
    const hasOpenIncoming = project.handoffs.some((handoff) =>
      handoff.toNodeId === activeNodeId && handoff.status === "open"
    );
    if (hasOpenIncoming) return;

    const activeNode = getNode(template, activeNodeId);
    if (!activeNode) return;
    getPreviousNodes(template, activeNode.id)
      .filter((previousNode) => isNodeDone(project, previousNode.id))
      .forEach((previousNode) => {
        project.handoffs.push({
          id: createUuid(),
          fromNodeId: previousNode.id,
          fromArea: previousNode.area,
          toNodeId: activeNode.id,
          toArea: activeNode.area,
          completedAt: project.nodeStartedAt[activeNode.id] ?? new Date().toISOString(),
          completedBy: "Sistema",
          status: "open",
          source: "return-chain"
        });
      });
  });
}

function returnToPreviousProcess(projectId, nodeId, handoffId, comment) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const template = getTemplate(project);
  const node = getNode(template, nodeId);
  const incoming = getOpenIncomingHandoffs(project, nodeId);
  if (!node || incoming.length === 0) return;

  const handoff = incoming.find((item) => item.id === handoffId) ?? incoming[0];
  const cleanComment = comment.trim();
  if (!cleanComment) return;

  handoff.status = "returned";
  handoff.returnedAt = new Date().toISOString();
  handoff.returnedBy = currentUser.name;
  handoff.returnComment = cleanComment;

  project.activeNodeIds = project.activeNodeIds.filter((id) => id !== nodeId);
  delete project.nodeStartedAt[nodeId];
  removeLastCompletion(project, handoff.fromNodeId);
  project.retryTargetsByNode = project.retryTargetsByNode ?? {};
  project.retryTargetsByNode[handoff.fromNodeId] = [...new Set([
    ...(project.retryTargetsByNode[handoff.fromNodeId] ?? []),
    nodeId
  ])];

  if (!project.activeNodeIds.includes(handoff.fromNodeId)) {
    project.activeNodeIds.push(handoff.fromNodeId);
    project.nodeStartedAt[handoff.fromNodeId] = new Date().toISOString();
  }
  ensureActiveReturnHandoffs(project, template);

  state.notifications = state.notifications ?? [];
  state.notifications.unshift({
    id: createUuid(),
    projectId: project.id,
    projectName: project.name,
    fromArea: node.area,
    toArea: handoff.fromArea,
    comment: cleanComment,
    createdAt: new Date().toISOString(),
    createdBy: currentUser.name,
    type: "return"
  });

  saveState();
  renderAll();
}

function removeLastCompletion(project, nodeId) {
  for (let index = project.history.length - 1; index >= 0; index -= 1) {
    if (project.history[index].nodeId === nodeId && !project.history[index].invalidatedAt) {
      project.history.splice(index, 1);
      return;
    }
  }
}

function allPreviousDone(template, project, nodeId) {
  const previous = getPreviousNodes(template, nodeId);
  return previous.every((node) => isNodeDone(project, node.id));
}

function getUpcomingNodes(project, area) {
  const template = getTemplate(project);
  if (project.completedAt) return [];
  return template.nodes.filter((node) => {
    if (node.area !== area) return false;
    if (project.activeNodeIds.includes(node.id) || isNodeDone(project, node.id)) return false;
    const previous = getPreviousNodes(template, node.id);
    if (previous.length === 0) return false;
    return previous.every((prevNode) => isNodeDone(project, prevNode.id) || project.activeNodeIds.includes(prevNode.id));
  });
}

function getPreviousNodes(template, nodeId) {
  return template.nodes.filter((node) => node.nextIds.includes(nodeId));
}

function getOpenIncomingHandoffs(project, nodeId) {
  return (project.handoffs ?? []).filter((handoff) => handoff.toNodeId === nodeId && handoff.status === "open");
}

function getCompletedWaitingNodes(project, area) {
  return (project.handoffs ?? []).filter((handoff) =>
    handoff.fromArea === area
    && handoff.status === "open"
    && !project.activeNodeIds.includes(handoff.fromNodeId)
  );
}

function relevantNotificationsForCurrentUser() {
  if (!currentUser) return [];
  const dismissed = new Set(state.notificationDismissals?.[currentUser.id] ?? []);
  return (state.notifications ?? [])
    .filter((item) => {
      if (dismissed.has(item.id)) return false;
      if (hasAdminAccess(currentUser)) return true;
      const targetUserIds = Array.isArray(item.toUserIds) ? item.toUserIds : [];
      const matchesDestination = item.toArea === currentUser.area
        && (targetUserIds.length === 0 || targetUserIds.includes(currentUser.id));
      return matchesDestination || item.fromArea === currentUser.area;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderNotificationCenter() {
  notificationCenter.classList.remove("is-hidden");
  const notifications = relevantNotificationsForCurrentUser();
  const reads = JSON.parse(localStorage.getItem(NOTIFICATION_READ_KEY) || "{}");
  const readIds = new Set(reads[currentUser.id] ?? []);
  const unread = notifications.filter((item) => !readIds.has(item.id)).length;
  notificationBadge.textContent = unread > 99 ? "99+" : String(unread);
  notificationBadge.classList.toggle("is-hidden", unread === 0);
  notificationFeed.innerHTML = notifications.length
    ? notifications.slice(0, 20).map((item) => `
      <article class="feed-item ${readIds.has(item.id) ? "" : "unread"}" data-feed-notification-id="${escapeHtml(item.id)}">
        <span class="feed-dot" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(notificationHeadline(item))}</strong>
          <p>${escapeHtml(item.comment)}</p>
          <small>${escapeHtml(formatDate(item.createdAt))} · ${escapeHtml(item.createdBy)}</small>
        </div>
        <button class="feed-delete-button" type="button" title="Eliminar notificacion" aria-label="Eliminar notificacion">X</button>
      </article>
    `).join("")
    : `<div class="empty-state">Todavia no tienes avisos.</div>`;
  notificationFeed.querySelectorAll(".feed-delete-button").forEach((button) => {
    button.addEventListener("click", () => dismissNotificationForCurrentUser(
      button.closest("[data-feed-notification-id]")?.dataset.feedNotificationId
    ));
  });
  clearReadNotificationsButton.classList.toggle("is-hidden", notifications.every((item) => !readIds.has(item.id)));
}

function toggleNotificationCenter() {
  const willOpen = notificationPopover.classList.contains("is-hidden");
  notificationPopover.classList.toggle("is-hidden", !willOpen);
  if (!willOpen || !currentUser) return;
  const visibleIds = relevantNotificationsForCurrentUser().map((item) => item.id);
  const reads = JSON.parse(localStorage.getItem(NOTIFICATION_READ_KEY) || "{}");
  reads[currentUser.id] = [...new Set([...(reads[currentUser.id] ?? []), ...visibleIds])].slice(-300);
  localStorage.setItem(NOTIFICATION_READ_KEY, JSON.stringify(reads));
  renderNotificationCenter();
}

function closeNotificationCenter() {
  notificationPopover.classList.add("is-hidden");
}

function dismissNotificationForCurrentUser(notificationId) {
  if (!canModifySharedState || !currentUser || !notificationId) return;
  state.notificationDismissals = state.notificationDismissals ?? {};
  state.notificationDismissals[currentUser.id] = [...new Set([
    ...(state.notificationDismissals[currentUser.id] ?? []),
    notificationId
  ])].slice(-500);
  saveState();
  renderNotificationCenter();
}

function dismissReadNotifications() {
  if (!canModifySharedState || !currentUser) return;
  const reads = JSON.parse(localStorage.getItem(NOTIFICATION_READ_KEY) || "{}");
  const readIds = new Set(reads[currentUser.id] ?? []);
  const idsToDismiss = relevantNotificationsForCurrentUser()
    .filter((item) => readIds.has(item.id))
    .map((item) => item.id);
  if (idsToDismiss.length === 0) return;
  state.notificationDismissals = state.notificationDismissals ?? {};
  state.notificationDismissals[currentUser.id] = [...new Set([
    ...(state.notificationDismissals[currentUser.id] ?? []),
    ...idsToDismiss
  ])].slice(-500);
  saveState();
  renderNotificationCenter();
}

function renderNotificationList(container, query = "") {
  const openNotifications = (state.notifications ?? [])
    .filter((item) =>
      !item.archivedAt
      && ["return", "customer-return", "process-block"].includes(item.type)
      && notificationMatchesSearch(item, query)
    );
  if (openNotifications.length === 0) return;
  if (openNotifications.length > 0) {
    container.appendChild(renderNotificationSection("Avisos de produccion", openNotifications, false));
  }
}

function normalizeSearch(value) {
  return String(value ?? "").trim().toLocaleLowerCase("es-MX");
}

function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function generateFiveDigitCode(usedCodes = new Set()) {
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const code = String(10000 + (values[0] % 90000));
    if (!usedCodes.has(code)) return code;
  }
  throw new Error("No se pudo generar un codigo unico.");
}

function generateUniqueProfileCode(excludeUserId = null) {
  const usedCodes = new Set(
    state.users
      .filter((user) => user.id !== excludeUserId)
      .map((user) => normalizeCode(user.code))
  );
  return generateFiveDigitCode(usedCodes);
}

function projectMatchesSearch(project, query) {
  if (!query) return true;
  const template = getTemplate(project);
  const product = getProduct(project.productId);
  const status = project.archivedAt
    ? "archivado archivo"
    : project.completedAt
      ? "completado listo"
      : getActiveNodes(project).map((node) => node.area).join(" ");
  return normalizeSearch([
    project.name,
    project.folio,
    product?.name,
    template?.name,
    project.startDate,
    project.dueDate,
    status,
    getScheduleStatus(project).label,
    ...Object.keys(project.assignments ?? {}).flatMap((nodeId) => getAssignedUsers(project, nodeId).map((user) => user.name)),
    ...(project.materials ?? []).map((material) => formatMaterial(material))
  ].filter(Boolean).join(" ")).includes(query);
}

function notificationMatchesSearch(notification, query) {
  if (!query) return true;
  const project = state.projects.find((item) => item.id === notification.projectId);
  return normalizeSearch([
    notification.projectName,
    project?.folio,
    notification.fromArea,
    notification.toArea,
    notification.comment,
    notification.createdBy
  ].filter(Boolean).join(" ")).includes(query);
}

function renderNotificationSection(title, notifications, archived) {
  const section = document.createElement("section");
  section.className = `notification-list ${archived ? "archived" : ""}`;
  section.innerHTML = `
    <div class="notification-list-head">
      <p class="eyebrow">${escapeHtml(title)}</p>
      ${archived ? "" : `<button class="small-button archive-all-notifications-button" type="button">Archivar todas</button>`}
    </div>
    ${notifications.slice(0, 5).map((item) => `
      <article class="notification-item" data-notification-id="${escapeHtml(item.id)}">
        <strong>${escapeHtml(notificationHeadline(item))}</strong>
        <span>${escapeHtml(item.fromArea)}: ${escapeHtml(item.comment)}</span>
        <div class="notification-footer">
          <small>${escapeHtml(formatDate(item.createdAt))} por ${escapeHtml(item.createdBy)}${item.archivedAt ? ` - Archivado ${escapeHtml(formatDate(item.archivedAt))}` : ""}</small>
          ${archived ? "" : item.type === "process-block"
            ? `<button class="primary-button unlock-process-button" type="button">Desbloquear proceso</button>`
            : `<button class="small-button archive-notification-button" type="button">Archivar</button>`}
        </div>
      </article>
    `).join("")}
  `;
  section.querySelectorAll(".archive-notification-button").forEach((button) => {
    button.addEventListener("click", () => archiveNotification(button.closest(".notification-item")?.dataset.notificationId));
  });
  section.querySelectorAll(".unlock-process-button").forEach((button) => {
    button.addEventListener("click", () => unlockProcess(button.closest(".notification-item")?.dataset.notificationId));
  });
  section.querySelector(".archive-all-notifications-button")?.addEventListener("click", archiveAllNotifications);
  return section;
}

function notificationHeadline(item) {
  if (item.type === "process-block") {
    return `${item.projectName} bloqueado en ${item.fromArea}`;
  }
  if (item.type === "process-unlocked") {
    return `${item.projectName} desbloqueado en ${item.toArea}`;
  }
  if (item.type === "new-project") {
    return `Nuevo pedido: ${item.projectName}`;
  }
  if (item.type === "process-arrival") {
    return `${item.projectName} avanzo a ${item.toArea}`;
  }
  return `${item.projectName} regresado a ${item.toArea}`;
}

function archiveNotification(notificationId) {
  const notification = (state.notifications ?? []).find((item) => item.id === notificationId);
  if (!notification) return;
  notification.archivedAt = new Date().toISOString();
  notification.archivedBy = currentUser?.name ?? "Administracion";
  saveState();
  renderAll();
}

function archiveAllNotifications() {
  const archivedAt = new Date().toISOString();
  (state.notifications ?? []).forEach((notification) => {
    if (notification.archivedAt || notification.type === "process-block") return;
    notification.archivedAt = archivedAt;
    notification.archivedBy = currentUser?.name ?? "Administracion";
  });
  saveState();
  renderAll();
}

function renderArchivedNotifications(notifications) {
  const section = document.createElement("section");
  section.className = "notification-list archived";
  section.innerHTML = `<p class="eyebrow">Avisos archivados</p>`;
  notifications.forEach((item) => {
    const article = document.createElement("article");
    article.className = "notification-item";
    article.innerHTML = `
      <label class="archive-select">
        <input type="checkbox" data-archive-key="notification:${escapeHtml(item.id)}" />
        Seleccionar
      </label>
      <strong>${escapeHtml(notificationHeadline(item))}</strong>
      <span>${escapeHtml(item.fromArea)}: ${escapeHtml(item.comment)}</span>
      <small>${escapeHtml(formatDate(item.createdAt))} por ${escapeHtml(item.createdBy)} - Archivado ${escapeHtml(formatDate(item.archivedAt))}</small>
      <div class="notification-actions">
        <button class="history-button unarchive-button" type="button">Desarchivar</button>
        <button class="danger-button delete-notification-button" type="button">Borrar</button>
      </div>
    `;
    bindArchiveCheckbox(article.querySelector("[data-archive-key]"));
    article.querySelector(".unarchive-button").addEventListener("click", () => unarchiveNotification(item.id));
    article.querySelector(".delete-notification-button").addEventListener("click", () => deleteNotification(item.id));
    section.appendChild(article);
  });
  return section;
}

function bindAdminProjectCheckbox(checkbox) {
  checkbox.checked = adminProjectSelection.has(checkbox.dataset.adminProjectId);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) adminProjectSelection.add(checkbox.dataset.adminProjectId);
    else adminProjectSelection.delete(checkbox.dataset.adminProjectId);
    updateAdminProjectBatchControls();
  });
}

function selectAllVisibleProjects() {
  const allSelected = adminVisibleProjectIds.length > 0
    && adminVisibleProjectIds.every((projectId) => adminProjectSelection.has(projectId));
  adminVisibleProjectIds.forEach((projectId) => {
    if (allSelected) adminProjectSelection.delete(projectId);
    else adminProjectSelection.add(projectId);
  });
  renderAdminProjects();
}

function selectVisibleCompletedProjects() {
  adminProjectSelection.clear();
  adminVisibleCompletedIds.forEach((projectId) => adminProjectSelection.add(projectId));
  renderAdminProjects();
}

function updateAdminProjectBatchControls() {
  const selectedCompleted = [...adminProjectSelection].filter((projectId) =>
    state.projects.some((project) => project.id === projectId && project.completedAt && !project.archivedAt)
  );
  const allVisibleSelected = adminVisibleProjectIds.length > 0
    && adminVisibleProjectIds.every((projectId) => adminProjectSelection.has(projectId));
  selectAllProjectsButton.textContent = allVisibleSelected ? "Quitar seleccion" : "Seleccionar todo";
  selectAllProjectsButton.disabled = adminVisibleProjectIds.length === 0;
  selectCompletedProjectsButton.disabled = adminVisibleCompletedIds.length === 0;
  archiveSelectedProjectsButton.disabled = selectedCompleted.length === 0;
  archiveSelectedProjectsButton.textContent = selectedCompleted.length
    ? `Archivar seleccionados (${selectedCompleted.length})`
    : "Archivar seleccionados";
}

function archiveSelectedProjects() {
  const completed = state.projects.filter((project) =>
    adminProjectSelection.has(project.id) && project.completedAt && !project.archivedAt
  );
  if (completed.length === 0) return;
  const ignored = [...adminProjectSelection].length - completed.length;
  const note = ignored > 0 ? ` ${ignored} proyecto(s) activo(s) no se archivaran.` : "";
  if (!confirm(`Archivar ${completed.length} proyecto(s) completado(s)?${note}`)) return;
  const archivedAt = new Date().toISOString();
  completed.forEach((project) => {
    project.archivedAt = archivedAt;
    project.archivedBy = currentUser.name;
  });
  adminProjectSelection.clear();
  saveState();
  renderAll();
}

function bindArchiveCheckbox(checkbox) {
  if (!checkbox) return;
  checkbox.checked = archiveSelection.has(checkbox.dataset.archiveKey);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) archiveSelection.add(checkbox.dataset.archiveKey);
    else archiveSelection.delete(checkbox.dataset.archiveKey);
    updateArchiveActionState();
  });
}

function updateArchiveActionState() {
  const selectedButton = document.querySelector("#deleteSelectedArchiveButton");
  const unarchiveButton = document.querySelector("#unarchiveSelectedButton");
  const selectAllButton = document.querySelector("#selectAllArchiveButton");
  const allButton = document.querySelector("#deleteAllArchiveButton");
  const totalArchived = state.projects.filter((project) => project.archivedAt).length
    + (state.notifications ?? []).filter((item) => item.archivedAt).length;
  selectedButton.disabled = archiveSelection.size === 0;
  unarchiveButton.disabled = archiveSelection.size === 0;
  selectedButton.textContent = archiveSelection.size > 0
    ? `Borrar seleccionados (${archiveSelection.size})`
    : "Borrar seleccionados";
  unarchiveButton.textContent = archiveSelection.size > 0
    ? `Desarchivar seleccionados (${archiveSelection.size})`
    : "Desarchivar seleccionados";
  const allVisibleSelected = archiveVisibleKeys.length > 0
    && archiveVisibleKeys.every((key) => archiveSelection.has(key));
  selectAllButton.disabled = archiveVisibleKeys.length === 0;
  selectAllButton.textContent = allVisibleSelected ? "Quitar seleccion" : "Seleccionar todo";
  allButton.disabled = totalArchived === 0;
}

function selectAllVisibleArchive() {
  const allVisibleSelected = archiveVisibleKeys.length > 0
    && archiveVisibleKeys.every((key) => archiveSelection.has(key));
  archiveVisibleKeys.forEach((key) => {
    if (allVisibleSelected) archiveSelection.delete(key);
    else archiveSelection.add(key);
  });
  renderArchive();
}

function unarchiveSelected() {
  if (archiveSelection.size === 0) return;
  const projectIds = new Set();
  const notificationIds = new Set();
  archiveSelection.forEach((key) => {
    const [type, id] = key.split(":");
    if (type === "project") projectIds.add(id);
    if (type === "notification") notificationIds.add(id);
  });
  state.projects.forEach((project) => {
    if (!projectIds.has(project.id)) return;
    project.archivedAt = null;
    delete project.archivedBy;
  });
  (state.notifications ?? []).forEach((notification) => {
    if (!notificationIds.has(notification.id)) return;
    delete notification.archivedAt;
    delete notification.archivedBy;
  });
  archiveSelection.clear();
  saveState();
  renderAll();
}

function unarchiveNotification(notificationId) {
  const notification = (state.notifications ?? []).find((item) => item.id === notificationId);
  if (!notification) return;
  delete notification.archivedAt;
  delete notification.archivedBy;
  archiveSelection.delete(`notification:${notificationId}`);
  saveState();
  renderAll();
}

function archiveProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project?.completedAt) return;
  project.archivedAt = new Date().toISOString();
  project.archivedBy = currentUser?.name ?? "Administracion";
  saveState();
  renderAll();
}

function unarchiveProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  project.archivedAt = null;
  delete project.archivedBy;
  archiveSelection.delete(`project:${projectId}`);
  saveState();
  renderAll();
}

function deleteNotification(notificationId) {
  const notification = (state.notifications ?? []).find((item) => item.id === notificationId);
  if (!notification) return;
  if (!confirm(`Borrar definitivamente la devolucion de "${notification.projectName}"?`)) return;
  state.notifications = state.notifications.filter((item) => item.id !== notificationId);
  archiveSelection.delete(`notification:${notificationId}`);
  saveState();
  renderAll();
}

function deleteSelectedArchive() {
  if (archiveSelection.size === 0) return;
  if (!confirm(`Borrar definitivamente ${archiveSelection.size} elementos seleccionados?`)) return;
  const projectIds = new Set();
  const notificationIds = new Set();
  archiveSelection.forEach((key) => {
    const [type, id] = key.split(":");
    if (type === "project") projectIds.add(id);
    if (type === "notification") notificationIds.add(id);
  });
  state.projects = state.projects.filter((project) => !projectIds.has(project.id));
  state.notifications = (state.notifications ?? []).filter((item) => !notificationIds.has(item.id));
  archiveSelection.clear();
  saveState();
  renderAll();
}

function deleteAllArchive() {
  const completedCount = state.projects.filter((project) => project.archivedAt).length;
  const notificationCount = (state.notifications ?? []).filter((item) => item.archivedAt).length;
  const total = completedCount + notificationCount;
  if (total === 0) return;
  if (!confirm(`Borrar definitivamente todo el archivo (${total} elementos)? Esta accion no se puede deshacer.`)) return;
  state.projects = state.projects.filter((project) => !project.archivedAt);
  state.notifications = (state.notifications ?? []).filter((item) => !item.archivedAt);
  archiveSelection.clear();
  saveState();
  renderAll();
}

function deleteProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  if (!confirm(`Borrar "${project.name}" de la demo?`)) return;
  state.projects = state.projects.filter((item) => item.id !== projectId);
  archiveSelection.delete(`project:${projectId}`);
  saveState();
  renderAll();
}

function openProjectEditor(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  editingProjectId = projectId;
  editProjectNameInput.value = project.name;
  editProjectFolioInput.value = project.folio ?? "";
  editProjectProductSelect.innerHTML = `<option value="">Sin producto base</option>` + state.products
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)}</option>`)
    .join("");
  editProjectProductSelect.value = project.productId ?? "";
  editProjectStartDateInput.value = project.startDate ?? dateOnly(project.createdAt);
  editProjectDueDateInput.value = project.dueDate ?? "";
  clearDateError(editProjectDueDateInput, editProjectDateError);
  const product = getProduct(project.productId);
  if (product) {
    applyMinimumDueDate(
      editProjectStartDateInput,
      editProjectDueDateInput,
      product,
      project.templateId,
      editProjectDateError,
      false
    );
  } else {
    editProjectDueDateInput.min = editProjectStartDateInput.value || "";
  }
  renderProjectAssignmentEditor(project);
  projectEditDialog.showModal();
}

function renderProjectAssignmentEditor(project) {
  const template = getTemplate(project);
  renderAssignmentPicker(editProjectAssignments, template, project.assignments);
}

function renderAssignmentPicker(container, template, assignments = {}) {
  const normalizedAssignments = normalizeProjectAssignments(assignments);
  container.innerHTML = template.nodes.map((node) => {
    const selectedUserIds = normalizedAssignments[node.id] ?? [];
    const users = state.users
      .filter((user) => user.area === node.area)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
    return `
      <fieldset class="project-assignment-row" data-assignment-node-id="${escapeHtml(node.id)}">
        <legend>${escapeHtml(node.area)}</legend>
        <div class="assignment-options">
          ${users.length
            ? users.map((user) => `
              <label class="assignment-option">
                <input type="checkbox" value="${escapeHtml(user.id)}" ${selectedUserIds.includes(user.id) ? "checked" : ""} />
                <span>${escapeHtml(user.name)}</span>
              </label>
            `).join("")
            : `<p class="assignment-empty">No hay perfiles en esta area.</p>`}
        </div>
      </fieldset>
    `;
  }).join("");
}

function readAssignmentsFromPicker(container) {
  return Object.fromEntries(
    [...container.querySelectorAll("[data-assignment-node-id]")]
      .map((group) => [
        group.dataset.assignmentNodeId,
        [...group.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value)
      ])
      .filter(([, userIds]) => userIds.length > 0)
  );
}

function suggestEditedProjectDueDate() {
  const product = getProduct(editProjectProductSelect.value);
  if (product && editProjectStartDateInput.value) {
    const templateId = state.projects.find((item) => item.id === editingProjectId)?.templateId;
    applyMinimumDueDate(
      editProjectStartDateInput,
      editProjectDueDateInput,
      product,
      templateId,
      editProjectDateError,
      true
    );
  } else {
    editProjectDueDateInput.min = editProjectStartDateInput.value || "";
    clearDateError(editProjectDueDateInput, editProjectDateError);
  }
}

function saveProjectEdits() {
  const project = state.projects.find((item) => item.id === editingProjectId);
  const name = editProjectNameInput.value.trim();
  if (!project || !name || !editProjectStartDateInput.value) return;
  const previousProductId = project.productId ?? null;
  const productId = editProjectProductSelect.value || null;
  const product = getProduct(productId);
  if (!validateProjectDates(
    editProjectStartDateInput,
    editProjectDueDateInput,
    product,
    project.templateId,
    editProjectDateError
  )) return;

  project.name = name;
  project.folio = editProjectFolioInput.value.trim() || null;
  project.startDate = editProjectStartDateInput.value;
  project.dueDate = editProjectDueDateInput.value || null;
  project.productId = productId;
  project.assignments = readAssignmentsFromPicker(editProjectAssignments);
  if (productId !== previousProductId) {
    project.estimatedMinutesByArea = structuredClone(product?.areaMinutes ?? {});
    project.materials = structuredClone(product?.materials ?? []);
    project.documents = structuredClone(product?.documents ?? []);
  }

  editingProjectId = null;
  projectEditDialog.close();
  saveState();
  renderAll();
}

function showCatalogProductDetails(productId) {
  const product = getProduct(productId);
  if (!product) return;
  const template = state.templates.find((item) => item.id === product.templateId);
  catalogProductDetailsTitle.textContent = product.name;
  catalogProductDetailsContent.innerHTML = `
    <section class="details-summary product-details-summary">
      <div>
        <p class="eyebrow muted">Tipo</p>
        <h3>${escapeHtml(product.category || "Sin categoria")}</h3>
      </div>
      <div>
        <p class="eyebrow muted">Familia</p>
        <h3>${escapeHtml(product.family || "Sin familia")}</h3>
      </div>
      <div>
        <p class="eyebrow muted">Variante</p>
        <h3>${escapeHtml(product.variant || "Sin variante")}</h3>
      </div>
    </section>
    <section class="details-section">
      <p class="eyebrow muted">Plantilla sugerida</p>
      <h3>${escapeHtml(template?.name ?? "Sin plantilla")}</h3>
      ${template ? `<div class="project-tree-wrap">${renderFlowTree(template)}</div>` : ""}
    </section>
    <div class="project-planning-summary">
      <div>
        <p class="eyebrow muted">Materiales</p>
        ${renderMaterialList(product.materials, 100)}
      </div>
      <div>
        <p class="eyebrow muted">Tiempos estimados</p>
        <p class="planning-total"><strong>Total: ${escapeHtml(totalMinutes(product.areaMinutes))} min</strong> · ${escapeHtml(formatMinutesAsHours(totalMinutes(product.areaMinutes)))}</p>
        ${renderAreaMinuteList(product.areaMinutes, 100)}
      </div>
    </div>
    <section class="details-section technical-documents-section">
      <p class="eyebrow muted">Documentos tecnicos</p>
      ${renderDocumentLinks(product.documents)}
    </section>
  `;
  catalogProductDetailsDialog.showModal();
}

function showFolioDetails(folio) {
  const normalizedFolio = normalizeSearch(folio);
  if (!normalizedFolio) return;
  const projects = state.projects
    .filter((project) => normalizeSearch(project.folio) === normalizedFolio)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  folioDetailsTitle.textContent = `Folio ${folio}`;
  folioDetailsContent.innerHTML = projects.length ? `
    <div class="folio-detail-summary">
      <strong>${projects.length} ${projects.length === 1 ? "pedido" : "pedidos"}</strong>
      <span>${projects.filter((project) => project.completedAt).length} completados · ${projects.filter((project) => project.archivedAt).length} archivados</span>
    </div>
    <div class="folio-detail-list">
      ${projects.map((project) => {
        const activeNames = getActiveNodes(project).map((node) => node.area).join(" + ") || "Terminado";
        const product = getProduct(project.productId);
        return `
          <article class="folio-detail-card">
            <div>
              <h3>${escapeHtml(project.name)}</h3>
              <div class="project-meta">
                ${product ? `<span class="meta-chip">${escapeHtml(product.name)}</span>` : ""}
                <span class="meta-chip">Estado: ${escapeHtml(project.archivedAt ? "Archivado" : project.completedAt ? "Completado" : activeNames)}</span>
                ${project.startDate ? `<span class="meta-chip">Inicio: ${escapeHtml(formatPlainDate(project.startDate))}</span>` : ""}
                ${project.dueDate ? `<span class="meta-chip">Entrega: ${escapeHtml(formatPlainDate(project.dueDate))}</span>` : ""}
              </div>
            </div>
            <button class="history-button" data-project-detail-id="${escapeHtml(project.id)}" type="button">Ver detalle</button>
          </article>
        `;
      }).join("")}
    </div>
  ` : `<div class="empty-state">No hay pedidos con este folio.</div>`;
  folioDetailsContent.querySelectorAll("[data-project-detail-id]").forEach((button) => {
    button.addEventListener("click", () => {
      folioDetailsDialog.close();
      showProjectDetails(button.dataset.projectDetailId);
    });
  });
  folioDetailsDialog.showModal();
}

function showProjectDetails(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const template = getTemplate(project);
  const product = getProduct(project.productId);
  const activeNames = getActiveNodes(project).map((node) => node.area).join(" + ") || "Terminado";
  const schedule = getScheduleStatus(project);
  const returns = (state.notifications ?? []).filter((item) =>
    item.projectId === project.id && ["return", "customer-return"].includes(item.type)
  );
  const historyItems = [...(project.history ?? [])].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const handoffs = [...(project.handoffs ?? [])].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  const blockHistory = [...(project.blockHistory ?? [])].sort((a, b) => new Date(b.blockedAt) - new Date(a.blockedAt));

  projectDetailsTitle.textContent = project.name;
  projectDetailsContent.innerHTML = `
    <div class="details-actions">
      ${hasAdminAccess(currentUser) ? `<button class="history-button details-edit-button" type="button">Editar pedido</button>` : ""}
      <button class="history-button details-history-button" type="button">Ver historial por area</button>
    </div>
    <section class="details-summary">
      <div>
        <p class="eyebrow muted">Identificacion</p>
        <h3>${project.folio ? `Folio: ${escapeHtml(project.folio)}` : "Sin folio"}</h3>
        <p>${escapeHtml(product?.name ?? "Sin producto base")} · Plantilla ${escapeHtml(template.name)}</p>
      </div>
      <div>
        <p class="eyebrow muted">Estado actual</p>
        <h3>${escapeHtml(project.completedAt ? "Completado" : activeNames)}</h3>
        <p>${escapeHtml(schedule.label)}</p>
      </div>
      <div>
        <p class="eyebrow muted">Fechas</p>
        <h3>${escapeHtml(scheduleDateText(project))}</h3>
        <p>Creado ${escapeHtml(formatDate(project.createdAt))}${project.completedAt ? ` · Completado ${escapeHtml(formatDate(project.completedAt))}` : ""}</p>
      </div>
    </section>
    ${getProjectDocuments(project).length ? `
      <section class="details-section technical-documents-section">
        <p class="eyebrow muted">Documentos tecnicos</p>
        ${renderDocumentLinks(getProjectDocuments(project))}
      </section>
    ` : ""}
    ${renderProjectPlanningSummary(project)}
    <section class="details-section">
      <p class="eyebrow muted">Arbol del proceso</p>
      <div class="project-tree-wrap">${renderFlowTree(template, project)}</div>
    </section>
    <section class="details-section">
      <p class="eyebrow muted">Actividad registrada</p>
      <div class="details-log">
        ${historyItems.length ? historyItems.map((item) => `
          <article>
            <strong>${escapeHtml(item.area)}</strong>
            <span>Terminado por ${escapeHtml(item.user)} · ${escapeHtml(formatDate(item.completedAt))}</span>
            ${item.invalidatedAt ? `<small>Registro invalidado ${escapeHtml(formatDate(item.invalidatedAt))}</small>` : ""}
          </article>
        `).join("") : `<p class="muted-copy">Todavia no hay procesos terminados.</p>`}
      </div>
    </section>
    ${blockHistory.length ? `
      <section class="details-section">
        <p class="eyebrow muted">Bloqueos del proceso</p>
        <div class="details-log">
          ${blockHistory.map((item) => `
            <article>
              <strong>${escapeHtml(item.area)} · ${item.resolvedAt ? "Resuelto" : "Bloqueado"}</strong>
              <span>${escapeHtml(item.reason)}</span>
              <small>Bloqueado ${escapeHtml(formatDate(item.blockedAt))} por ${escapeHtml(item.blockedBy)}${item.resolvedAt ? ` · Desbloqueado ${escapeHtml(formatDate(item.resolvedAt))} por ${escapeHtml(item.resolvedBy)}` : ""}</small>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}
    ${returns.length ? `
      <section class="details-section return-details">
        <p class="eyebrow muted">Devoluciones y correcciones</p>
        <div class="details-log">
          ${returns.map((item) => `
            <article>
              <strong>${escapeHtml(item.fromArea)} regreso a ${escapeHtml(item.toArea)}</strong>
              <span>${escapeHtml(item.comment)}</span>
              <small>${escapeHtml(formatDate(item.createdAt))} por ${escapeHtml(item.createdBy)}</small>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}
    ${handoffs.length ? `
      <section class="details-section">
        <p class="eyebrow muted">Movimientos entre areas</p>
        <div class="details-log">
          ${handoffs.map((item) => `
            <article>
              <strong>${escapeHtml(item.fromArea)} → ${escapeHtml(item.toArea)}</strong>
              <span>${escapeHtml(item.status === "returned" ? "Regresado" : item.status === "accepted" ? "Recibido" : "Esperando revision")}</span>
              <small>${escapeHtml(formatDate(item.completedAt))} por ${escapeHtml(item.completedBy)}</small>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}
  `;
  projectDetailsContent.querySelector(".details-edit-button")?.addEventListener("click", () => {
    projectDetailsDialog.close();
    openProjectEditor(project.id);
  });
  projectDetailsContent.querySelector(".details-history-button").addEventListener("click", () => {
    projectDetailsDialog.close();
    showHistory(project.id);
  });
  projectDetailsDialog.showModal();
}

function showHistory(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const template = getTemplate(project);
  historyTitle.textContent = project.name;
  const reopeningHistory = (project.reopenings ?? []).map((item) => `
    <div class="history-item reopening-history">
      <strong>Devuelto por cliente</strong>
      <div>
        <h3>Regreso a ${escapeHtml(item.area)}</h3>
        <p>${escapeHtml(item.comment)}</p>
        <small>${escapeHtml(formatDate(item.reopenedAt))} por ${escapeHtml(item.reopenedBy)}</small>
      </div>
    </div>
  `).join("");
  historyContent.innerHTML = reopeningHistory + template.nodes.map((node) => {
    const item = [...project.history].reverse().find((entry) => entry.nodeId === node.id && !entry.invalidatedAt);
    const active = project.activeNodeIds.includes(node.id) && !project.completedAt;
    let status = "Pendiente";
    let detail = "Aun no llega a esta area.";
    if (item) {
      status = "Completado";
      detail = `Por ${escapeHtml(item.user)} el ${escapeHtml(formatDate(item.completedAt))}`;
    } else if (active) {
      status = "En proceso";
      detail = `Desde ${escapeHtml(formatDate(project.nodeStartedAt[node.id]))}`;
    }

    return `
      <div class="history-item">
        <strong>${escapeHtml(node.area)}</strong>
        <div>
          <h3>${status}</h3>
          <p>${detail}</p>
        </div>
      </div>
    `;
  }).join("");
  historyDialog.showModal();
}

function addArea() {
  const area = areaNameInput.value.trim();
  if (!area) return;
  if (state.areas.includes(area)) {
    alert("Esa area ya existe.");
    return;
  }
  state.areas.push(area);
  state.users.push({
    id: createUuid(),
    name: area,
    area,
    role: "worker",
    code: generateUniqueProfileCode()
  });
  saveState();
  areaForm.reset();
  renderLogin();
  renderAll();
}

function deleteArea(area) {
  const used = state.templates.some((template) => template.nodes.some((node) => node.area === area));
  if (used) {
    alert("No puedo borrar esta area porque una plantilla la esta usando.");
    return;
  }
  if (!confirm(`Borrar el area "${area}"?`)) return;
  state.areas = state.areas.filter((item) => item !== area);
  state.users = state.users.filter((user) => user.area !== area);
  saveState();
  renderLogin();
  renderAll();
}

function openTemplateEditor(templateId = null) {
  const template = state.templates.find((item) => item.id === templateId);
  editingTemplateId = templateId;
  templateDialogTitle.textContent = template ? "Editar plantilla" : "Nueva plantilla";
  templateNameInput.value = template?.name ?? "";
  editingNodes = template ? structuredClone(template.nodes) : [
    { id: createUuid(), area: state.areas[0] ?? "Diseno", nextIds: [] }
  ];
  renderTemplateBuilder();
  templateDialog.showModal();
}

function renderTemplateBuilder() {
  templateBuilder.innerHTML = "";
  editingNodes.forEach((node, index) => {
    const row = document.createElement("div");
    row.className = "builder-row";
    row.innerHTML = `
      <div class="builder-main">
        <label>
          Paso ${index + 1}
          <select data-field="area">${state.areas.map((area) => `<option value="${escapeHtml(area)}" ${area === node.area ? "selected" : ""}>${escapeHtml(area)}</option>`).join("")}</select>
        </label>
        <label>
          Envia a
          <select data-field="next" multiple size="4">
            ${editingNodes.filter((option) => option.id !== node.id).map((option) => `<option value="${option.id}" ${node.nextIds.includes(option.id) ? "selected" : ""}>${escapeHtml(option.area)}</option>`).join("")}
          </select>
        </label>
      </div>
      <button class="danger-button tiny" type="button">Quitar</button>
    `;
    row.querySelector('[data-field="area"]').addEventListener("change", (event) => {
      node.area = event.target.value;
      renderTemplateBuilder();
    });
    row.querySelector('[data-field="next"]').addEventListener("change", (event) => {
      node.nextIds = [...event.target.selectedOptions].map((option) => option.value);
      renderTemplatePreview();
    });
    row.querySelector("button").addEventListener("click", () => {
      editingNodes = editingNodes.filter((item) => item.id !== node.id);
      editingNodes.forEach((item) => {
        item.nextIds = item.nextIds.filter((id) => id !== node.id);
      });
      renderTemplateBuilder();
    });
    templateBuilder.appendChild(row);
  });
  renderTemplatePreview();
}

function renderTemplatePreview() {
  if (editingNodes.length === 0) {
    templatePreview.innerHTML = `<div class="empty-state">Agrega un paso para comenzar el flujo.</div>`;
    return;
  }
  if (templateHasCycle(editingNodes)) {
    templatePreview.innerHTML = `<div class="template-preview-warning">El flujo se regresa sobre si mismo. Quita una conexion circular para poder guardarlo.</div>`;
    return;
  }
  const previewTemplate = {
    id: "template-preview",
    name: templateNameInput.value.trim() || "Vista previa",
    nodes: structuredClone(editingNodes)
  };
  templatePreview.innerHTML = renderFlowTree(previewTemplate);
}

function templateHasCycle(nodes) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    const node = nodes.find((item) => item.id === nodeId);
    const cyclic = (node?.nextIds ?? []).filter((nextId) => nodeIds.has(nextId)).some(visit);
    visiting.delete(nodeId);
    visited.add(nodeId);
    return cyclic;
  }

  return nodes.some((node) => visit(node.id));
}

function saveTemplateFromEditor() {
  const name = templateNameInput.value.trim();
  if (!name || editingNodes.length < 1) return;
  if (templateHasCycle(editingNodes)) {
    alert("El flujo no puede regresar a un paso anterior. Revisa la vista previa.");
    return;
  }
  if (editingNodes.every((node) => node.nextIds.length > 0)) {
    alert("La plantilla necesita al menos un paso final sin salida.");
    return;
  }
  const template = { id: editingTemplateId ?? createUuid(), name, nodes: structuredClone(editingNodes) };
  const index = state.templates.findIndex((item) => item.id === template.id);
  if (index >= 0) state.templates[index] = template;
  else state.templates.push(template);
  saveState();
  templateDialog.close();
  renderAll();
}

function deleteTemplate(templateId) {
  const used = state.projects.some((project) => project.templateId === templateId);
  if (used) {
    alert("No puedo borrar esta plantilla porque hay proyectos usandola.");
    return;
  }
  if (!confirm("Borrar esta plantilla?")) return;
  state.templates = state.templates.filter((template) => template.id !== templateId);
  saveState();
  renderAll();
}

function getTemplate(project) {
  return state.templates.find((template) => template.id === project.templateId) ?? state.templates[0];
}

function getNode(template, nodeId) {
  return template.nodes.find((node) => node.id === nodeId);
}

function getActiveNodes(project) {
  const template = getTemplate(project);
  return project.activeNodeIds.map((nodeId) => getNode(template, nodeId)).filter(Boolean);
}

function getStartNodes(template) {
  const targeted = new Set(template.nodes.flatMap((node) => node.nextIds));
  return template.nodes.filter((node) => !targeted.has(node.id));
}

function isNodeDone(project, nodeId) {
  return project.history.some((item) => item.nodeId === nodeId && !item.invalidatedAt);
}

function timeInNode(project, nodeId) {
  const start = new Date(project.nodeStartedAt[nodeId] ?? project.createdAt);
  return formatDuration(start);
}

function longestActiveTime(project) {
  const starts = project.activeNodeIds.map((nodeId) => new Date(project.nodeStartedAt[nodeId] ?? project.createdAt));
  const oldest = starts.sort((a, b) => a - b)[0] ?? new Date();
  return formatDuration(oldest);
}

function isProjectArchived(project) {
  return Boolean(project.archivedAt);
}

function readyArchiveText(project) {
  if (project.archivedAt) return `Archivado: ${formatDate(project.archivedAt)}`;
  return `Completado: ${formatDate(project.completedAt)}`;
}

function getProduct(productId, source = state) {
  if (!productId) return null;
  return (source.products ?? []).find((product) => product.id === productId) ?? null;
}

function materialRow(quantity, unit, name) {
  return { quantity, unit, name };
}

function normalizeAreaMinutes(areaMinutes = {}, legacyAreaHours = null) {
  if (areaMinutes && Object.keys(areaMinutes).length > 0) {
    return Object.fromEntries(
      Object.entries(areaMinutes)
        .map(([area, minutes]) => [area, Math.max(0, Math.round(Number(minutes) || 0))])
        .filter(([, minutes]) => minutes > 0)
    );
  }
  if (!legacyAreaHours) return {};
  return Object.fromEntries(
    Object.entries(legacyAreaHours)
      .map(([area, hours]) => [area, Math.max(0, Math.round((Number(hours) || 0) * 60))])
      .filter(([, minutes]) => minutes > 0)
  );
}

function normalizeMaterialRows(materials) {
  if (!Array.isArray(materials)) return parseLegacyMaterialLines(materials);
  return materials
    .map((material) => normalizeMaterialRow(material))
    .filter((material) => material.name);
}

function normalizeProductDocuments(documents) {
  if (!Array.isArray(documents)) return [];
  return documents
    .map((item) => ({
      title: String(item?.title ?? "").trim(),
      url: normalizeDocumentUrl(item?.url)
    }))
    .filter((item) => item.title && item.url);
}

function getProjectDocuments(project) {
  const productDocuments = normalizeProductDocuments(getProduct(project.productId)?.documents);
  return productDocuments.length ? productDocuments : normalizeProductDocuments(project.documents);
}

function normalizeDocumentUrl(value) {
  const url = String(value ?? "").trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function renderDocumentLinks(documents) {
  const cleanDocuments = normalizeProductDocuments(documents);
  if (cleanDocuments.length === 0) return `<p class="muted-text">Sin documentos.</p>`;
  return `
    <div class="document-link-list">
      ${cleanDocuments.map((item) => `
        <a class="document-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">
          <span aria-hidden="true">&#128196;</span>
          <strong>${escapeHtml(item.title)}</strong>
        </a>
      `).join("")}
    </div>
  `;
}

function normalizeMaterialRow(material) {
  if (typeof material === "string") return parseLegacyMaterialLine(material);
  return {
    quantity: material?.quantity ?? "",
    unit: String(material?.unit ?? "").trim(),
    name: String(material?.name ?? material?.material ?? "").trim()
  };
}

function parseLegacyMaterialLines(value) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((line) => parseLegacyMaterialLine(line))
    .filter((material) => material.name);
}

function parseLegacyMaterialLine(line) {
  const text = String(line ?? "").trim();
  if (!text) return materialRow("", "", "");
  const dashParts = text.split(/\s+-\s+/);
  if (dashParts.length >= 2) {
    const name = dashParts.slice(0, -1).join(" - ").trim();
    const amount = dashParts.at(-1).trim();
    const match = amount.match(/^([\d.,]+)\s*(.*)$/);
    return materialRow(match?.[1]?.replace(",", ".") ?? "", match?.[2]?.trim() ?? "", name);
  }
  const match = text.match(/^([\d.,]+)\s+([^\s]+)\s+(.+)$/);
  if (match) return materialRow(match[1].replace(",", "."), match[2], match[3]);
  return materialRow("", "", text);
}

function totalMinutes(areaMinutes = {}) {
  return Object.values(areaMinutes).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function criticalPathMinutes(areaMinutes = {}, templateId = null) {
  const template = state.templates.find((item) => item.id === templateId);
  if (!template?.nodes?.length) return totalMinutes(areaMinutes);
  const memo = new Map();
  const visiting = new Set();

  function remainingFrom(nodeId) {
    if (memo.has(nodeId)) return memo.get(nodeId);
    if (visiting.has(nodeId)) return 0;
    visiting.add(nodeId);
    const node = getNode(template, nodeId);
    if (!node) return 0;
    const ownMinutes = Math.max(0, Number(areaMinutes[node.area]) || 0);
    const nextMinutes = node.nextIds.length
      ? Math.max(...node.nextIds.map((nextId) => remainingFrom(nextId)))
      : 0;
    visiting.delete(nodeId);
    const result = ownMinutes + nextMinutes;
    memo.set(nodeId, result);
    return result;
  }

  const startNodes = getStartNodes(template);
  return startNodes.length
    ? Math.max(...startNodes.map((node) => remainingFrom(node.id)))
    : totalMinutes(areaMinutes);
}

function workingMinutesForDate(date) {
  const day = date.getDay();
  if (day === 0) return 0;
  if (day === 6) return 420;
  return 600;
}

function calculateDueDate(startDate, areaMinutes = {}, templateId = null) {
  let remaining = criticalPathMinutes(areaMinutes, templateId);
  if (!startDate || remaining <= 0) return "";
  const date = new Date(`${startDate}T12:00:00`);
  let guard = 0;
  while (remaining > 0 && guard < 3660) {
    remaining -= workingMinutesForDate(date);
    if (remaining <= 0) return dateOnly(date);
    date.setDate(date.getDate() + 1);
    guard += 1;
  }
  return "";
}

function minimumDueDate(product, startDate, templateId) {
  if (!product || !startDate) return "";
  return calculateDueDate(startDate, product.areaMinutes, templateId || product.templateId);
}

function applyMinimumDueDate(startInput, dueInput, product, templateId, errorElement, replaceIfTooEarly) {
  const minimum = minimumDueDate(product, startInput.value, templateId);
  dueInput.min = minimum;
  if (minimum && (!dueInput.value || (replaceIfTooEarly && dueInput.value < minimum))) {
    dueInput.value = minimum;
  }
  validateProjectDates(startInput, dueInput, product, templateId, errorElement);
}

function validateProjectDates(startInput, dueInput, product, templateId, errorElement) {
  clearDateError(dueInput, errorElement);
  dueInput.min = startInput.value || "";
  if (startInput.value && dueInput.value && dueInput.value < startInput.value) {
    const message = "La entrega no puede ser anterior al inicio del proyecto.";
    dueInput.setCustomValidity(message);
    errorElement.textContent = message;
    errorElement.classList.remove("is-hidden");
    return false;
  }
  if (!product || !startInput.value) return true;
  const minimum = minimumDueDate(product, startInput.value, templateId);
  dueInput.min = minimum;
  if (!minimum || !dueInput.value || dueInput.value >= minimum) return true;
  const criticalMinutes = criticalPathMinutes(product.areaMinutes, templateId || product.templateId);
  const message = `La entrega es imposible con la jornada actual. Minimo ${formatMinutesAsHours(criticalMinutes)} de produccion; fecha sugerida: ${formatPlainDate(minimum)}.`;
  dueInput.setCustomValidity(message);
  errorElement.textContent = message;
  errorElement.classList.remove("is-hidden");
  return false;
}

function clearDateError(dueInput, errorElement) {
  dueInput.setCustomValidity("");
  errorElement.textContent = "";
  errorElement.classList.add("is-hidden");
}

function getScheduleStatus(project) {
  if (!project.dueDate) return { type: "none", label: "Entrega no definida" };
  const due = startOfDay(project.dueDate);
  const today = startOfDay(new Date());
  if (project.completedAt) {
    const completed = startOfDay(project.completedAt);
    return completed > due
      ? { type: "late", label: `Termino tarde por ${daysBetween(due, completed)} d` }
      : { type: "done", label: "A tiempo" };
  }
  if (today > due) return { type: "late", label: `Atrasado ${daysBetween(due, today)} d` };
  if (today.getTime() === due.getTime()) return { type: "today", label: "Entrega hoy" };
  return { type: "ok", label: `Faltan ${daysBetween(today, due)} d` };
}

function scheduleDateText(project) {
  const start = project.startDate ? `Inicio ${formatPlainDate(project.startDate)}` : "Sin inicio";
  const due = project.dueDate ? `Entrega ${formatPlainDate(project.dueDate)}` : "entrega pendiente";
  return `${start} - ${due}`;
}

function calendarSortValue(project) {
  const status = getScheduleStatus(project);
  const penalty = status.type === "late" ? -100000000000000 : status.type === "today" ? -50000000000000 : 0;
  return (project.dueDate ? new Date(`${project.dueDate}T12:00:00`).getTime() : Number.MAX_SAFE_INTEGER) + penalty;
}

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(start, end) {
  return Math.max(0, Math.round((startOfDay(end) - startOfDay(start)) / 86400000));
}

function dateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatPlainDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function formatQuantity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return Number.isInteger(number) ? String(number) : String(number.toFixed(2)).replace(/\.?0+$/, "");
}

function formatMaterial(material) {
  const clean = normalizeMaterialRow(material);
  const amount = clean.quantity ? `${formatQuantity(clean.quantity)} ${clean.unit}`.trim() : "";
  return amount ? `${amount} ${clean.name}` : clean.name;
}

function renderMaterialList(items, limit = 6) {
  const cleanItems = normalizeMaterialRows(items);
  if (cleanItems.length === 0) return `<p class="muted-text">Sin materiales.</p>`;
  const visible = cleanItems.slice(0, limit);
  const extra = cleanItems.length - visible.length;
  return `
    <ul class="compact-list">
      ${visible.map((item) => `<li>${escapeHtml(formatMaterial(item))}</li>`).join("")}
      ${extra > 0 ? `<li class="muted-text">+ ${extra} mas</li>` : ""}
    </ul>
  `;
}

function renderAreaMinuteList(areaMinutes = {}, limit = 8) {
  const entries = Object.entries(areaMinutes).filter(([, minutes]) => Number(minutes) > 0);
  if (entries.length === 0) return `<p class="muted-text">Sin tiempos.</p>`;
  const visible = entries.slice(0, limit);
  const extra = entries.length - visible.length;
  return `
    <div class="area-hour-list">
      ${visible.map(([area, minutes]) => `<span>${escapeHtml(area)}: <strong>${escapeHtml(minutes)} min</strong></span>`).join("")}
      ${extra > 0 ? `<span>+ ${extra} mas</span>` : ""}
    </div>
  `;
}

function formatDuration(start) {
  const now = new Date();
  const minutes = Math.max(1, Math.floor((now - start) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function createUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
