Enredo.session = {
  atHome: true,
  diagramFullscreen: false,
  charactersOpen: false,
  universeOpen: false,
  managementOpen: false,
  presentation: null,
  navigationCollapsed: false,
  fullscreenNavigationCollapsed: true,
  detailsCollapsed: false,
  diagramScroll: 0,
  viewMode: 'timeline',
  lastMapMode: 'timeline',
  structureStageSelection: null,
  mapNeedsFit: true,
  selection: null,
  connectMode: false,
  source: null,
  positionField(mode = this.viewMode) {
    if (mode === 'whole-story') return 'wholeStoryPosition';
    if (mode === 'story-map') return 'storyMapPosition';
    return null;
  },
  isStoryOverview(mode = this.viewMode) { return this.positionField(mode) !== null; },
  isStructureView() { return this.viewMode === 'structure'; },
  hasMapView() { return !this.isStructureView() && !this.charactersOpen && !this.universeOpen && !this.managementOpen && !this.presentation; }
};
