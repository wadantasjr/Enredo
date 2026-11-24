Enredo.session = {
  atHome: true,
  diagramFullscreen: false,
  charactersOpen: false,
  managementOpen: false,
  presentation: null,
  detailsCollapsed: false,
  diagramScroll: 0,
  viewMode: 'timeline',
  lastMapMode: 'timeline',
  structureStageSelection: null,
  mapNeedsFit: true,
  selection: null,
  connectMode: false,
  source: null,
  isWholeStory() { return this.viewMode === 'whole-story'; },
  isStructureView() { return this.viewMode === 'structure'; },
  hasMapView() { return !this.isStructureView() && !this.charactersOpen && !this.managementOpen && !this.presentation; }
};
