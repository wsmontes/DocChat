/**
 * CSV Visualization Helper
 * Provides interactive visualizations for CSV data analysis
 */
class CSVVisualizer {
    constructor() {
        this.charts = {};
        this.network = null;
        this.colorPalette = [
            '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
            '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
        ];
    }

    /**
     * Initialize the visualizer with container elements
     * @param {Object} containers - DOM containers for visualizations
     */
    initialize(containers) {
        this.containers = containers;
        this.clearAllVisualizations();
    }

    /**
     * Clear all visualizations
     */
    clearAllVisualizations() {
        // Clean up previous charts
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
        
        // Clean up network visualization
        if (this.network) {
            this.network.destroy();
            this.network = null;
        }
        
        // Clear containers
        if (this.containers) {
            Object.values(this.containers).forEach(container => {
                if (container) container.innerHTML = '';
            });
        }
    }

    /**
     * Create visualizations based on CSV analysis
     * @param {Object} analysisData - CSV analysis results
     */
    createVisualizations(analysisData) {
        this.clearAllVisualizations();
        
        if (!analysisData || !this.containers) return;
        
        // Create relationship graph
        if (analysisData.columnRelationships && this.containers.relationshipGraph) {
            this.createRelationshipGraph(analysisData.columnRelationships);
        }
        
        // Create distribution charts
        if (analysisData.dataDistributions && this.containers.distributions) {
            this.createDistributionCharts(analysisData.dataDistributions);
        }
        
        // Create quality heatmap
        if (analysisData.qualityHeatmap && this.containers.qualityMap) {
            this.createQualityHeatmap(analysisData.qualityHeatmap);
        }
    }

    /**
     * Create relationship graph visualization
     * @param {Object} relationshipData - Column relationship data
     */
    createRelationshipGraph(relationshipData) {
        const container = this.containers.relationshipGraph;
        if (!container || !relationshipData) return;
        
        // Check if we have vis-network.js available
        if (typeof vis === 'undefined' || !vis.Network) {
            container.innerHTML = `
                <div class="p-4 bg-light border rounded text-center">
                    <p><i class="bi bi-exclamation-triangle text-warning"></i> Visualization library not loaded.</p>
                    <p class="small">Relationship graph requires vis-network.js</p>
                </div>
            `;
            return;
        }
        
        // Create nodes with different colors by data type
        const nodes = new vis.DataSet(relationshipData.nodes.map(node => {
            // Determine color based on data type
            let color;
            switch (node.type) {
                case 'numeric': color = '#4e79a7'; break;
                case 'string': color = '#f28e2c'; break;
                case 'date': color = '#e15759'; break;
                case 'boolean': color = '#76b7b2'; break;
                default: color = '#bab0ab';
            }
            
            return {
                id: node.id,
                label: node.label,
                title: `${node.label} (${node.type})${node.unique ? ' - Unique' : ''}`,
                color: { 
                    background: color,
                    border: '#ffffff',
                    highlight: { background: color, border: '#000000' }
                },
                font: { color: '#ffffff' },
                borderWidth: node.unique ? 3 : 1,
                shape: node.unique ? 'star' : 'dot',
                size: node.unique ? 30 : 20
            };
        }));
        
        // Create edges
        const edges = new vis.DataSet(relationshipData.links.map((link, index) => {
            let color, dashes;
            
            switch (link.type) {
                case 'primary-foreign':
                    color = '#59a14f';
                    dashes = false;
                    break;
                case 'correlation':
                    color = '#af7aa1';
                    dashes = [5, 5];
                    break;
                default:
                    color = '#bab0ab';
                    dashes = [2, 2];
            }
            
            return {
                id: index,
                from: link.source,
                to: link.target,
                title: `${link.type} (strength: ${Math.round(link.strength * 100)}%)`,
                color: { color, highlight: color },
                width: Math.max(1, link.strength * 5),
                dashes
            };
        }));
        
        // Create network
        const data = { nodes, edges };
        const options = {
            nodes: {
                font: { size: 12 },
                borderWidth: 1,
                shadow: true
            },
            edges: {
                smooth: { type: 'continuous' },
                arrows: { to: { enabled: true, scaleFactor: 0.5 } }
            },
            physics: {
                barnesHut: { gravitationalConstant: -2000, centralGravity: 0.1 },
                stabilization: { iterations: 250 }
            },
            interaction: { hover: true, navigationButtons: true, tooltipDelay: 200 }
        };
        
        this.network = new vis.Network(container, data, options);
        
        // Add hover event to highlight connected nodes
        this.network.on('hoverNode', params => {
            const nodeId = params.node;
            const connectedNodes = this.network.getConnectedNodes(nodeId);
            const connectedEdges = this.network.getConnectedEdges(nodeId);
            
            nodes.update(nodes.get().map(node => ({
                id: node.id,
                opacity: connectedNodes.includes(node.id) || node.id === nodeId ? 1 : 0.3
            })));
            
            edges.update(edges.get().map(edge => ({
                id: edge.id,
                opacity: connectedEdges.includes(edge.id) ? 1 : 0.3
            })));
        });
        
        this.network.on('blurNode', () => {
            // Reset opacity
            nodes.update(nodes.get().map(node => ({ id: node.id, opacity: 1 })));
            edges.update(edges.get().map(edge => ({ id: edge.id, opacity: 1 })));
        });
    }

    /**
     * Create distribution charts
     * @param {Object} distributionData - Distribution chart data
     */
    createDistributionCharts(distributionData) {
        const container = this.containers.distributions;
        if (!container || !distributionData) return;
        
        // Check if we have Chart.js available
        if (typeof Chart === 'undefined') {
            container.innerHTML = `
                <div class="p-4 bg-light border rounded text-center">
                    <p><i class="bi bi-exclamation-triangle text-warning"></i> Visualization library not loaded.</p>
                    <p class="small">Distribution charts require Chart.js</p>
                </div>
            `;
            return;
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Create a chart for each field with distribution data
        Object.entries(distributionData).forEach(([field, dist], index) => {
            // Create a canvas for this chart
            const chartId = `chart-${field.replace(/[^a-z0-9]/gi, '-')}`;
            const chartContainer = document.createElement('div');
            chartContainer.className = 'mb-4 p-3 border rounded bg-white';
            chartContainer.innerHTML = `
                <h6 class="chart-title mb-3">${field} Distribution</h6>
                <canvas id="${chartId}" width="400" height="200"></canvas>
            `;
            container.appendChild(chartContainer);
            
            // Create the chart
            const chartCanvas = document.getElementById(chartId);
            const chartConfig = {
                type: dist.type === 'histogram' ? 'bar' : 'bar',
                data: {
                    labels: dist.labels,
                    datasets: [{
                        label: field,
                        data: dist.data,
                        backgroundColor: this.colorPalette[index % this.colorPalette.length],
                        borderColor: 'rgba(255, 255, 255, 0.8)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { display: false },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: { 
                            beginAtZero: true,
                            title: { display: true, text: 'Count' }
                        },
                        x: {
                            title: { display: true, text: dist.type === 'histogram' ? 'Range' : 'Value' }
                        }
                    }
                }
            };
            
            this.charts[field] = new Chart(chartCanvas, chartConfig);
        });
    }

    /**
     * Create data quality heatmap
     * @param {Object} qualityData - Data quality metrics
     */
    createQualityHeatmap(qualityData) {
        const container = this.containers.qualityMap;
        if (!container || !qualityData) return;
        
        // If no visualization library, create a simple HTML table representation
        container.innerHTML = '';
        
        const qualityTable = document.createElement('table');
        qualityTable.className = 'table table-sm table-bordered quality-heatmap';
        
        // Create header
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Column</th>
                <th>Completeness</th>
                <th>Uniqueness</th>
                <th>Consistency</th>
                <th>Overall Quality</th>
            </tr>
        `;
        qualityTable.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        
        Object.entries(qualityData).forEach(([field, metrics]) => {
            // Calculate overall quality score
            const overallScore = (
                metrics.completeness * 0.4 + 
                metrics.uniqueness * 0.2 + 
                (1 - metrics.outliers) * 0.1 + 
                metrics.consistency * 0.3
            );
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${field}</td>
                <td class="text-center">${this.renderQualityCell(metrics.completeness)}</td>
                <td class="text-center">${this.renderQualityCell(metrics.uniqueness)}</td>
                <td class="text-center">${this.renderQualityCell(metrics.consistency)}</td>
                <td class="text-center">${this.renderQualityCell(overallScore)}</td>
            `;
            
            tbody.appendChild(row);
        });
        
        qualityTable.appendChild(tbody);
        container.appendChild(qualityTable);
    }

    /**
     * Render a quality cell with color coding
     * @param {number} value - Quality value (0-1)
     * @returns {string} HTML for the cell
     */
    renderQualityCell(value) {
        // Determine color based on quality value
        let color;
        if (value >= 0.8) {
            color = 'success';
        } else if (value >= 0.6) {
            color = 'info';
        } else if (value >= 0.4) {
            color = 'warning';
        } else {
            color = 'danger';
        }
        
        const percentage = Math.round(value * 100);
        
        return `
            <div class="quality-indicator">
                <div class="progress" style="height: 15px">
                    <div class="progress-bar bg-${color}" role="progressbar" 
                         style="width: ${percentage}%" 
                         aria-valuenow="${percentage}" aria-valuemin="0" aria-valuemax="100">
                    </div>
                </div>
                <span class="quality-text small">${percentage}%</span>
            </div>
        `;
    }
}

// Export as global instance
window.csvVisualizer = new CSVVisualizer();
