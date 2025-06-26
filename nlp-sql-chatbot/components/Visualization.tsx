import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, AreaChart, Area, ComposedChart, 
  RadialBarChart, RadialBar, Treemap, FunnelChart, Funnel, LabelList,
  ReferenceLine, ReferenceArea
} from 'recharts';
import { 
  BarChart2, LineChart as LineChartIcon, PieChart as PieChartIcon, 
  ScatterChart as ScatterIcon, AreaChart as AreaIcon, Activity,
  CircleUser as RadialIcon, Triangle, X, Check, Settings, ChevronDown,
  Target, Filter, Layers, TrendingUp, Gauge, Zap, Eye, ArrowLeft, Download,
  Grid3X3, TrendingDown
} from 'lucide-react';

// Define chart types
export type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'scatter' | 'area' | 'composed' | 'radial' | 'treemap' | 'funnel' | 'gauge' | 'waterfall' | 'heatmap' | 'pyramid' | 'bubble';

interface VisualizationProps {
  data: any[];
  onClose: () => void;
  embedded?: boolean;
  databaseType?: string; // Add database type prop
  tableSchema?: any; // Add table schema for better recommendations
}

interface ChartDataItem {
  name: string;
  value: number;
}

interface ChartOption {
  type: ChartType;
  label: string;
  icon: React.ReactNode;
  recommended?: boolean;
  compatible: boolean;
  description?: string;
}

interface DrilldownState {
  isActive: boolean;
  selectedCategory?: string;
  filteredData?: any[];
  breadcrumb?: string[];
  level: number;
  history: Array<{
    data: any[];
    category: string;
    level: number;
  }>;
}

// Utility function to format numerical values to 2 decimal places
const formatNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  if (isNaN(num)) return 0;
  return parseFloat(num.toFixed(2));
};

// Custom tooltip formatter
const formatTooltipValue = (value: any, name: string): [string, string] => {
  if (typeof value === 'number') {
    return [formatNumber(value).toString(), name];
  }
  return [String(value), name];
};

// Database-specific chart recommendations
const getDatabaseSpecificRecommendations = (databaseType: string, dataCharacteristics: any) => {
  const { numericalColumns, categoricalColumns, dateColumns, dataSize, uniqueCategories } = dataCharacteristics;
  
  switch (databaseType?.toLowerCase()) {
    case 'ecommerce':
    case 'retail':
      // E-commerce databases often benefit from sales trends, category comparisons
      if (dateColumns.length > 0 && numericalColumns.length > 0) {
        return ['line', 'area']; // Time series for sales trends
      }
      if (categoricalColumns.length > 0 && numericalColumns.length > 0) {
        return ['bar', 'donut']; // Category comparisons
      }
      break;
      
    case 'financial':
    case 'banking':
      // Financial data often needs trend analysis and correlation
      if (numericalColumns.length >= 2) {
        return ['scatter', 'bubble']; // Correlation analysis
      }
      if (dateColumns.length > 0) {
        return ['line', 'area']; // Time series
      }
      break;
      
    case 'analytics':
    case 'marketing':
      // Analytics often needs heatmaps and funnel analysis
      if (numericalColumns.length >= 2 && categoricalColumns.length >= 1) {
        return ['heatmap', 'bubble'];
      }
      if (uniqueCategories <= 8 && numericalColumns.length >= 1) {
        return ['funnel', 'pyramid'];
      }
      break;
      
    case 'hr':
    case 'human_resources':
      // HR data often needs distribution and hierarchy charts
      if (categoricalColumns.length > 0) {
        return ['bar', 'pyramid'];
      }
      break;
      
    default:
      return null;
  }
  
  return null;
};

export default function Visualization({ data, onClose, embedded = false, databaseType, tableSchema }: VisualizationProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [secondaryYAxis, setSecondaryYAxis] = useState<string>('');
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [numericalColumns, setNumericalColumns] = useState<string[]>([]);
  const [categoricalColumns, setCategoricalColumns] = useState<string[]>([]);
  const [recommendedChart, setRecommendedChart] = useState<ChartType>('bar');
  const [showOptions, setShowOptions] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [drilldown, setDrilldown] = useState<DrilldownState>({ 
    isActive: false, 
    level: 0, 
    history: [] 
  });
  const [isMounted, setIsMounted] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // COLORS for charts - Updated for dark theme with more variety
  const COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', 
    '#EC4899', '#6366F1', '#14B8A6', '#F472B6', '#A855F7', '#22D3EE', '#FCD34D', '#FB7185'
  ];
  
  // Detect column types and recommend chart when data changes
  useEffect(() => {
    if (!data || data.length === 0) return;
    
    const columns = Object.keys(data[0]);
    setAvailableColumns(columns);
    
    // Identify numerical and categorical columns
    const numerical: string[] = [];
    const categorical: string[] = [];
    const dateColumns: string[] = [];
    
    columns.forEach(col => {
      // Check if the column has numeric values
      const isNumeric = data.every(row => {
        const val = row[col];
        return val === null || val === undefined || !isNaN(Number(val));
      });

      // Check if the column might contain dates
      const mightBeDate = data.every(row => {
        const val = row[col];
        if (val === null || val === undefined) return true;
        const dateVal = new Date(val);
        return !isNaN(dateVal.getTime());
      });
      
      if (isNumeric) {
        numerical.push(col);
      } else {
        categorical.push(col);
      }

      if (mightBeDate) {
        dateColumns.push(col);
      }
    });
    
    setNumericalColumns(numerical);
    setCategoricalColumns(categorical);
    
    // Calculate data characteristics for database-specific recommendations
    const uniqueCategories = new Set();
    if (categorical.length > 0) {
      data.forEach(row => uniqueCategories.add(row[categorical[0]]));
    }
    
    const dataCharacteristics = {
      numericalColumns: numerical,
      categoricalColumns: categorical,
      dateColumns,
      dataSize: data.length,
      uniqueCategories: uniqueCategories.size
    };
    
    // Get database-specific recommendations first
    let recommendedType: ChartType = 'bar';
    const dbRecommendations = getDatabaseSpecificRecommendations(databaseType || '', dataCharacteristics);
    
    if (dbRecommendations && dbRecommendations.length > 0) {
      // Use database-specific recommendation
      recommendedType = dbRecommendations[0] as ChartType;
    } else {
      // Fallback to general data-based recommendations
      // If we have time/date data, recommend a line chart
      if (dateColumns.length > 0 && numerical.length > 0) {
        recommendedType = 'line';
      } 
      // If we have few categorical items with numeric values, pie chart is often good
      else if (categorical.length > 0 && numerical.length > 0) {
        if (uniqueCategories.size <= 8) {
          recommendedType = 'donut';
        } else if (uniqueCategories.size <= 12) {
          recommendedType = 'pyramid'; // New: pyramid for medium categories
        } else {
          recommendedType = 'bar';
        }
      } 
      // If we have multiple numerical columns, scatter plot might be interesting
      else if (numerical.length >= 2) {
        if (numerical.length >= 3 && categorical.length >= 1) {
          recommendedType = 'heatmap'; // New: heatmap for complex multi-dimensional data
        } else {
          recommendedType = 'bubble';
        }
      } 
      // Default to bar chart
      else {
        recommendedType = 'bar';
      }
    }
    
    // Set the recommended chart type
    setRecommendedChart(recommendedType);
    setChartType(recommendedType);
    
    // Set default axes based on chart type and data characteristics
    let defaultX = '';
    let defaultY = '';
    let defaultSecondary = '';
    
    // Smart axis selection based on chart type
    switch (recommendedType) {
      case 'line':
      case 'area':
        // Time series charts: date on X, numerical on Y
        defaultX = dateColumns[0] || categorical[0] || columns[0];
        defaultY = numerical[0] || columns[1] || columns[0];
        break;
        
      case 'scatter':
      case 'bubble':
        // Correlation charts: numerical on both axes
        defaultX = numerical[0] || columns[0];
        defaultY = numerical[1] || numerical[0] || columns[1] || columns[0];
        if (recommendedType === 'bubble' && numerical.length > 2) {
          defaultSecondary = numerical[2];
        }
        break;
        
      case 'heatmap':
        // Heatmap: categorical on X, numerical/categorical on Y, numerical for intensity
        defaultX = categorical[0] || columns[0];
        defaultY = categorical[1] || numerical[0] || columns[1] || columns[0];
        defaultSecondary = numerical[0] || columns[2] || columns[0];
        break;
        
      case 'pyramid':
      case 'funnel':
        // Hierarchy charts: categorical on X, numerical on Y
        defaultX = categorical[0] || columns[0];
        defaultY = numerical[0] || columns[1] || columns[0];
        break;
        
      default:
        // Default logic: categorical/date on X, numerical on Y
        defaultX = categorical[0] || dateColumns[0] || columns[0];
        defaultY = numerical[0] || columns[1] || columns[0];
        if (numerical.length > 1) {
          defaultSecondary = numerical[1];
        }
        break;
    }
    
    setXAxis(defaultX);
    setYAxis(defaultY);
    if (defaultSecondary) {
      setSecondaryYAxis(defaultSecondary);
    }
  }, [data, databaseType]);
  
  // Determine which chart types are compatible with the current data
  const getChartOptions = (): ChartOption[] => {
    const hasNumericalX = numericalColumns.includes(xAxis);
    const hasNumericalY = numericalColumns.includes(yAxis);
    const hasCategoricalX = categoricalColumns.includes(xAxis);
    
    // Number of unique values in X axis (for pie charts)
    let xAxisUniqueValues = new Set();
    if (data && data.length > 0) {
      data.forEach(row => xAxisUniqueValues.add(row[xAxis]));
    }
    
    return [
      {
        type: 'bar',
        label: 'Bar Chart',
        icon: <BarChart2 className="h-4 w-4" />,
        compatible: true,
        recommended: recommendedChart === 'bar',
        description: 'Best for comparing values across categories'
      },
      {
        type: 'line',
        label: 'Line Chart',
        icon: <LineChartIcon className="h-4 w-4" />,
        compatible: true,
        recommended: recommendedChart === 'line',
        description: 'Best for showing trends over time or continuous data'
      },
      {
        type: 'area',
        label: 'Area Chart',
        icon: <AreaIcon className="h-4 w-4" />,
        compatible: true,
        recommended: recommendedChart === 'area',
        description: 'Similar to line chart but with filled areas'
      },
      {
        type: 'pie',
        label: 'Pie Chart',
        icon: <PieChartIcon className="h-4 w-4" />,
        compatible: xAxisUniqueValues.size <= 10 && hasNumericalY,
        recommended: recommendedChart === 'pie',
        description: 'Traditional pie chart for part-to-whole comparisons'
      },
      {
        type: 'donut',
        label: 'Donut Chart',
        icon: <Target className="h-4 w-4" />,
        compatible: xAxisUniqueValues.size <= 10 && hasNumericalY,
        recommended: recommendedChart === 'donut',
        description: 'Modern donut chart with better readability'
      },
      {
        type: 'scatter',
        label: 'Scatter Plot',
        icon: <ScatterIcon className="h-4 w-4" />,
        compatible: hasNumericalX && hasNumericalY,
        recommended: recommendedChart === 'scatter',
        description: 'Best for showing correlation between two numeric variables'
      },
      {
        type: 'bubble',
        label: 'Bubble Chart',
        icon: <Zap className="h-4 w-4" />,
        compatible: numericalColumns.length >= 2,
        recommended: recommendedChart === 'bubble',
        description: 'Enhanced scatter plot with bubble sizes representing values'
      },
      {
        type: 'composed',
        label: 'Composed Chart',
        icon: <Activity className="h-4 w-4" />,
        compatible: numericalColumns.length >= 2,
        recommended: recommendedChart === 'composed',
        description: 'Combines multiple chart types (bar and line)'
      },
      {
        type: 'radial',
        label: 'Radial Bar',
        icon: <RadialIcon className="h-4 w-4" />,
        compatible: hasNumericalY && xAxisUniqueValues.size <= 8,
        recommended: recommendedChart === 'radial',
        description: 'Circular bar chart good for part-to-whole comparisons'
      },
      {
        type: 'treemap',
        label: 'Treemap',
        icon: <Triangle className="h-4 w-4" />,
        compatible: hasNumericalY,
        recommended: recommendedChart === 'treemap',
        description: 'Hierarchical data where areas represent values'
      },
      {
        type: 'funnel',
        label: 'Funnel Chart',
        icon: <Filter className="h-4 w-4" />,
        compatible: hasNumericalY && xAxisUniqueValues.size <= 8,
        recommended: recommendedChart === 'funnel',
        description: 'Shows progressive reduction of data across stages'
      },
      {
        type: 'gauge',
        label: 'Gauge Chart',
        icon: <Gauge className="h-4 w-4" />,
        compatible: hasNumericalY && data.length === 1,
        recommended: recommendedChart === 'gauge',
        description: 'Single value visualization like a speedometer'
      },
      {
        type: 'waterfall',
        label: 'Waterfall Chart',
        icon: <TrendingUp className="h-4 w-4" />,
        compatible: hasNumericalY,
        recommended: recommendedChart === 'waterfall',
        description: 'Shows cumulative effect of sequential values'
      },
      {
        type: 'heatmap',
        label: 'Heatmap',
        icon: <Grid3X3 className="h-4 w-4" />,
        compatible: numericalColumns.length >= 2 && categoricalColumns.length >= 1,
        recommended: recommendedChart === 'heatmap',
        description: 'Visualizes data density and intensity'
      },
      {
        type: 'pyramid',
        label: 'Pyramid Chart',
        icon: <TrendingDown className="h-4 w-4" />,
        compatible: categoricalColumns.length > 0,
        recommended: recommendedChart === 'pyramid',
        description: 'Hierarchy representation with decreasing values'
      }
    ];
  };
  
  const chartOptions = getChartOptions();
  const compatibleCharts = chartOptions.filter(option => option.compatible);
  
  // Handle drilldown functionality
  const handleDrilldown = (category: string) => {
    const currentData = drilldown.isActive ? drilldown.filteredData || [] : data;
    const filtered = currentData.filter(row => String(row[xAxis]) === category);
    
    setDrilldown(prev => ({
      isActive: true,
      selectedCategory: category,
      filteredData: filtered,
      breadcrumb: [...(prev.breadcrumb || []), category],
      level: prev.level + 1,
      history: [...prev.history, {
        data: currentData,
        category: prev.selectedCategory || 'Overview',
        level: prev.level
      }]
    }));
  };

  const resetDrilldown = () => {
    setDrilldown({ 
      isActive: false, 
      level: 0, 
      history: [] 
    });
  };

  // CSV Export functionality for visualization data
  const exportChartDataToCSV = () => {
    const sourceData = drilldown.isActive ? drilldown.filteredData : data;
    if (!sourceData || sourceData.length === 0) return;
    
    const headers = Object.keys(sourceData[0]);
    const csvContent = [
      // Header row
      headers.map(header => `"${header}"`).join(','),
      // Data rows
      ...sourceData.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle different data types
          if (value === null || value === undefined) return '""';
          if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const filename = drilldown.isActive 
      ? `chart_data_${drilldown.selectedCategory}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
      : `chart_data_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const drillBack = () => {
    if (drilldown.history.length > 0) {
      const previous = drilldown.history[drilldown.history.length - 1];
      const newHistory = drilldown.history.slice(0, -1);
      const newBreadcrumb = drilldown.breadcrumb?.slice(0, -1) || [];
      
      if (newHistory.length === 0) {
        // Back to original data
        setDrilldown({ 
          isActive: false, 
          level: 0, 
          history: [] 
        });
      } else {
        setDrilldown({
          isActive: true,
          selectedCategory: previous.category,
          filteredData: previous.data,
          breadcrumb: newBreadcrumb,
          level: previous.level,
          history: newHistory
        });
      }
    }
  };

  // Prepare data for visualization
  const prepareChartData = (): any[] => {
    const sourceData = drilldown.isActive ? drilldown.filteredData : data;
    if (!xAxis || !yAxis || !sourceData || sourceData.length === 0) return [];

    // For pie, donut, radial, funnel, and treemap charts, we need to aggregate data by xAxis
    if (['pie', 'donut', 'radial', 'funnel', 'treemap'].includes(chartType)) {
      const aggregated: { [key: string]: number } = {};
      sourceData.forEach(row => {
        const key = String(row[xAxis] || 'Unknown');
        const value = formatNumber(row[yAxis] || 0);
        
        if (aggregated[key]) {
          aggregated[key] = formatNumber(aggregated[key] + value);
        } else {
          aggregated[key] = value;
        }
      });
      
      return Object.entries(aggregated).map(([name, value]) => ({ 
        name: name.length > 15 ? name.substring(0, 12) + '...' : name, // Truncate long names
        fullName: name, // Keep full name for tooltip
        value 
      }));
    }
    
    // For scatter and bubble plots
    if (chartType === 'scatter' || chartType === 'bubble') {
      return sourceData.map((row, index) => ({
        name: row[xAxis] || 'Unknown',
        x: formatNumber(row[xAxis] || 0),
        y: formatNumber(row[yAxis] || 0),
        z: chartType === 'bubble' ? formatNumber(row[secondaryYAxis] || row[yAxis] || 10) : 10, // Bubble size
        fill: COLORS[index % COLORS.length]
      }));
    }

    // For composed charts with two y-axes
    if (chartType === 'composed' && secondaryYAxis) {
      return sourceData.map(row => ({
        name: row[xAxis] || 'Unknown',
        primary: formatNumber(row[yAxis] || 0),
        secondary: formatNumber(row[secondaryYAxis] || 0)
      }));
    }

    // For waterfall charts
    if (chartType === 'waterfall') {
      let cumulative = 0;
      return sourceData.map((row, index) => {
        const value = formatNumber(row[yAxis] || 0);
        const start = cumulative;
        cumulative = formatNumber(cumulative + value);
        return {
          name: row[xAxis] || 'Unknown',
          value: value,
          cumulative: cumulative,
          start: start,
          end: cumulative
        };
      });
    }

    // For gauge chart (single value)
    if (chartType === 'gauge') {
      const value = formatNumber(sourceData[0]?.[yAxis] || 0);
      const maxValue = formatNumber(Math.max(...sourceData.map(row => Number(row[yAxis] || 0))) * 1.2);
      return [{ name: yAxis, value, max: maxValue }];
    }
    
    // For bar, line, and area charts
    return sourceData.map(row => ({
      name: row[xAxis] || 'Unknown',
      value: formatNumber(row[yAxis] || 0)
    }));
  };
  
  const chartData = prepareChartData();

  // Custom label function for pie/donut charts
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    if (percent < 0.05) return null; // Hide labels for slices smaller than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const renderAutoChart = () => {
    const chartToRender = autoMode ? recommendedChart : chartType;
    
    switch (chartToRender) {
      case 'bar':
        return (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#D1D5DB' }} />
            <YAxis tick={{ fill: '#D1D5DB' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }}
              formatter={formatTooltipValue}
            />
            <Legend />
            <Bar 
              dataKey="value" 
              name={yAxis} 
              fill="#3B82F6"
              onClick={(data) => handleDrilldown(data.name)}
              style={{ cursor: 'pointer' }}
            />
          </BarChart>
        );
      
      case 'line':
        return (
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#D1D5DB' }} />
            <YAxis tick={{ fill: '#D1D5DB' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }}
              formatter={formatTooltipValue}
            />
            <Legend />
            <Line type="monotone" dataKey="value" name={yAxis} stroke="#3B82F6" activeDot={{ r: 8 }} />
          </LineChart>
        );
      
      case 'area':
        return (
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#D1D5DB' }} />
            <YAxis tick={{ fill: '#D1D5DB' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }}
              formatter={formatTooltipValue}
            />
            <Legend />
            <Area type="monotone" dataKey="value" name={yAxis} fill="#3B82F6" stroke="#3B82F6" />
          </AreaChart>
        );
      
      case 'pie':
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              fill="#3B82F6"
              dataKey="value"
              onClick={(data) => handleDrilldown(data.fullName || data.name)}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }} 
              formatter={(value: number, name: string, props: any) => [formatNumber(value), props.payload.fullName || name]} 
            />
            <Legend 
              formatter={(value, entry: any) => entry.payload.fullName || value}
            />
          </PieChart>
        );

      case 'donut':
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              innerRadius={40}
              fill="#3B82F6"
              dataKey="value"
              onClick={(data) => handleDrilldown(data.fullName || data.name)}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }} 
              formatter={(value: number, name: string, props: any) => [formatNumber(value), props.payload.fullName || name]} 
            />
            <Legend 
              formatter={(value, entry: any) => entry.payload.fullName || value}
            />
          </PieChart>
        );
      
      case 'scatter':
        return (
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="x" name={xAxis} type="number" tick={{ fill: '#D1D5DB' }} />
            <YAxis dataKey="y" name={yAxis} type="number" tick={{ fill: '#D1D5DB' }} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }} 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }}
              formatter={formatTooltipValue}
            />
            <Legend />
            <Scatter name={`${xAxis} vs ${yAxis}`} data={chartData} fill="#3B82F6" />
          </ScatterChart>
        );

      case 'bubble':
        return (
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="x" name={xAxis} type="number" tick={{ fill: '#D1D5DB' }} />
            <YAxis dataKey="y" name={yAxis} type="number" tick={{ fill: '#D1D5DB' }} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }} 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }}
              formatter={formatTooltipValue}
            />
            <Legend />
            <Scatter name="Bubble Data" data={chartData}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Scatter>
          </ScatterChart>
        );
      
      case 'composed':
        return (
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#D1D5DB' }} />
            <YAxis yAxisId="left" tick={{ fill: '#D1D5DB' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#D1D5DB' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }}
              formatter={formatTooltipValue}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="primary" name={yAxis} fill="#3B82F6" />
            <Line yAxisId="right" type="monotone" dataKey="secondary" name={secondaryYAxis} stroke="#10B981" />
          </ComposedChart>
        );
      
      case 'radial':
        return (
          <RadialBarChart cx="50%" cy="50%" innerRadius="10%" outerRadius="80%" data={chartData}>
            <RadialBar 
              label={{ position: 'insideStart', fill: '#fff' }} 
              background 
              dataKey="value" 
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </RadialBar>
            <Legend />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }} 
            />
          </RadialBarChart>
        );
      
      case 'treemap':
        return (
          <Treemap
            width={400}
            height={200}
            data={chartData}
            dataKey="value"
            nameKey="name"
            aspectRatio={4/3}
            stroke="#374151"
            fill="#3B82F6"
          >
            {
              chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))
            }
          </Treemap>
        );

      case 'funnel':
        return (
          <FunnelChart width={400} height={300}>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }} 
            />
            <Funnel
              dataKey="value"
              data={chartData}
              isAnimationActive
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
              <LabelList position="center" fill="#fff" stroke="none" />
            </Funnel>
          </FunnelChart>
        );

      case 'gauge':
        const gaugeData = chartData[0];
        const percentage = gaugeData ? (gaugeData.value / gaugeData.max) * 100 : 0;
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="20"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="80"
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="20"
                  strokeDasharray={`${percentage * 5.02} 502`}
                  strokeLinecap="round"
                  transform="rotate(-90 100 100)"
                />
                <text
                  x="100"
                  y="100"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-2xl font-bold fill-white"
                >
                  {gaugeData?.value || 0}
                </text>
                <text
                  x="100"
                  y="120"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-sm fill-gray-400"
                >
                  {`${percentage.toFixed(1)}%`}
                </text>
              </svg>
            </div>
          </div>
        );

      case 'waterfall':
        return (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#D1D5DB' }} />
            <YAxis tick={{ fill: '#D1D5DB' }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151', 
                borderRadius: '8px',
                color: '#F9FAFB'
              }} 
            />
            <Legend />
            <Bar dataKey="start" stackId="a" fill="transparent" />
            <Bar dataKey="value" stackId="a">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10B981' : '#EF4444'} />
              ))}
            </Bar>
          </BarChart>
        );
      
      case 'heatmap':
        // Prepare heatmap data
        const heatmapData = (() => {
          const sourceData = drilldown.isActive ? drilldown.filteredData : data;
          if (!sourceData || sourceData.length === 0) return [];
          
          // Create a grid of values
          const gridData: { x: string; y: string; value: number; intensity: number }[] = [];
          const maxValue = Math.max(...sourceData.map(d => Number(d[secondaryYAxis] || d[yAxis] || 0)));
          
          sourceData.forEach((row, index) => {
            const x = String(row[xAxis] || 'Unknown');
            const y = String(row[yAxis] || 'Unknown');
            const value = Number(row[secondaryYAxis] || row[yAxis] || 0);
            const intensity = maxValue > 0 ? (value / maxValue) * 100 : 0;
            
            gridData.push({ x, y, value, intensity });
          });
          
          return gridData;
        })();
        
        return (
          <div className="h-full w-full p-4">
            <div className="grid gap-1" style={{ 
              gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(heatmapData.length)), 10)}, 1fr)`,
              gridTemplateRows: `repeat(${Math.min(Math.ceil(heatmapData.length / Math.ceil(Math.sqrt(heatmapData.length))), 10)}, 1fr)`
            }}>
              {heatmapData.map((cell, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium cursor-pointer hover:scale-105 transition-transform"
                  style={{
                    backgroundColor: `rgba(59, 130, 246, ${cell.intensity / 100})`,
                    color: cell.intensity > 50 ? 'white' : '#1F2937',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                  onClick={() => handleDrilldown(cell.x)}
                  title={`${cell.x} × ${cell.y}: ${cell.value}`}
                >
                  <div className="truncate w-full text-center px-1">{cell.x}</div>
                  <div className="text-xs opacity-75 truncate w-full text-center px-1">{cell.y}</div>
                  <div className="font-bold">{cell.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-blue-500/20 border border-blue-500/30"></div>
                <span className="text-sm text-gray-400">Low</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-blue-500/60 border border-blue-500/30"></div>
                <span className="text-sm text-gray-400">Medium</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded bg-blue-500 border border-blue-500/30"></div>
                <span className="text-sm text-gray-400">High</span>
              </div>
            </div>
          </div>
        );
      
      case 'pyramid':
        // Prepare pyramid data
        const pyramidData = (() => {
          const sourceData = drilldown.isActive ? drilldown.filteredData : data;
          if (!sourceData || sourceData.length === 0) return [];
          
          // Sort data by value in descending order for pyramid effect
          const sortedData = [...sourceData]
            .map(row => ({
              name: String(row[xAxis] || 'Unknown'),
              value: Number(row[yAxis] || 0),
              fullName: String(row[xAxis] || 'Unknown')
            }))
            .sort((a, b) => b.value - a.value);
          
          return sortedData.slice(0, 8); // Limit to 8 levels for visual clarity
        })();
        
        const maxPyramidValue = Math.max(...pyramidData.map(d => d.value));
        
        return (
          <div className="h-full w-full p-4 flex flex-col items-center justify-center">
            <div className="w-full max-w-md space-y-2">
              {pyramidData.map((level, index) => {
                const width = (level.value / maxPyramidValue) * 100;
                const color = COLORS[index % COLORS.length];
                
                return (
                  <div
                    key={index}
                    className="relative cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => handleDrilldown(level.name)}
                  >
                    <div
                      className="h-12 rounded-lg flex items-center justify-between px-4 text-white font-medium shadow-lg border border-gray-600"
                      style={{
                        backgroundColor: color,
                        width: `${Math.max(width, 20)}%`,
                        marginLeft: `${(100 - Math.max(width, 20)) / 2}%`
                      }}
                    >
                      <span className="text-sm truncate">{level.name}</span>
                      <span className="text-sm font-bold">{level.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-400">
                {pyramidData.length > 0 ? `Showing top ${pyramidData.length} levels` : 'No data available'}
              </p>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-gray-400 text-center">
            <p>Select valid axes to display chart</p>
          </div>
        );
    }
  };
  
  // If embedded in dashboard, render a simplified version
  if (embedded) {
    return (
      <div className="h-full w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {renderAutoChart()}
          </ResponsiveContainer>
        ) : (
          <div className="text-gray-400 text-center h-full flex items-center justify-center">
            <p>No data available to visualize</p>
          </div>
        )}
      </div>
    );
  }
  
  // Full visualization modal
  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        // Close modal when clicking on backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-gray-800 rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-7xl max-h-[98vh] border border-gray-700 animate-in zoom-in-95 duration-300 overflow-hidden flex flex-col relative z-[10000]" style={{ zIndex: 10000 }}>
        <div className="p-3 sm:p-6 overflow-y-auto flex-1">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-white">Visualize Data</h2>
              {drilldown.isActive && (
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                  {drilldown.history.length > 0 && (
                    <button
                      onClick={drillBack}
                      className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-lg text-xs sm:text-sm hover:bg-yellow-500/30 transition-colors"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span className="hidden sm:inline">Back</span>
                    </button>
                  )}
                  <button
                    onClick={resetDrilldown}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs sm:text-sm hover:bg-blue-500/30 transition-colors"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400">
                    <span>L{drilldown.level}:</span>
                    <span className="font-medium text-gray-300 max-w-20 sm:max-w-none truncate">{drilldown.selectedCategory}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto-mode"
                  checked={autoMode}
                  onChange={(e) => setAutoMode(e.target.checked)}
                  className="mr-1 sm:mr-2 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700"
                />
                <label htmlFor="auto-mode" className="text-xs sm:text-sm text-gray-300">Auto</label>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-1.5 sm:p-2 rounded-full hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          <div className="bg-blue-500/20 p-3 sm:p-4 rounded-xl mb-4 sm:mb-6 border border-blue-500/30">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="bg-blue-500/30 p-1.5 rounded-lg">
                  {chartOptions.find(opt => opt.type === (autoMode ? recommendedChart : chartType))?.icon || 
                   <BarChart2 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-400" />}
                </div>
                <div>
                  <h3 className="font-medium text-blue-300 text-sm sm:text-base">
                    {autoMode ? 
                      `Recommended: ${chartOptions.find(opt => opt.type === recommendedChart)?.label || 'Bar Chart'}` : 
                      chartOptions.find(opt => opt.type === chartType)?.label || 'Bar Chart'}
                  </h3>
                  <p className="text-xs text-blue-400 hidden sm:block">
                    {chartOptions.find(opt => opt.type === (autoMode ? recommendedChart : chartType))?.description || 
                     'Visualizing your data effectively'}
                  </p>
                </div>
              </div>
                             <div className="flex items-center gap-2 w-full sm:w-auto">
                 <div className="flex items-center gap-1 text-xs text-blue-400">
                   <Eye className="h-3 w-3" />
                   <span className="hidden sm:inline">Click chart elements to drill down</span>
                   <span className="sm:hidden">Click to drill</span>
                 </div>
                 <button
                   onClick={exportChartDataToCSV}
                   className="bg-emerald-600 hover:bg-emerald-700 text-xs sm:text-sm flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-white transition-colors flex-shrink-0"
                   title="Export chart data as CSV"
                 >
                   <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                   <span className="hidden sm:inline">Export CSV</span>
                   <span className="sm:hidden">CSV</span>
                 </button>
                 <button 
                   onClick={() => setShowOptions(!showOptions)}
                   className="bg-gray-700 text-xs sm:text-sm flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white flex-shrink-0"
                 >
                   <Settings className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                   <span className="hidden sm:inline">Change Chart Type</span>
                   <span className="sm:hidden">Charts</span>
                   <ChevronDown className={`h-3 w-3 sm:h-3.5 sm:w-3.5 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
                 </button>
               </div>
            </div>
          </div>

          {/* Parameters Selection - ALWAYS VISIBLE */}
          <div className="bg-gray-700/50 p-3 sm:p-4 rounded-xl mb-4 sm:mb-6 border border-gray-600">
            <h3 className="text-sm font-medium text-white mb-3">Data Axes Selection</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="space-y-1">
                <label className="text-xs sm:text-sm font-medium text-gray-300">X-Axis / Categories</label>
                <select
                  value={xAxis}
                  onChange={(e) => setXAxis(e.target.value)}
                  className="w-full border border-gray-600 rounded-lg p-2 bg-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {availableColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 hidden sm:block">
                  {categoricalColumns.includes(xAxis) ? 'Categorical data - Good choice!' : 
                   'Numerical data - Usually better for Y-axis'}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs sm:text-sm font-medium text-gray-300">Y-Axis / Values</label>
                <select
                  value={yAxis}
                  onChange={(e) => setYAxis(e.target.value)}
                  className="w-full border border-gray-600 rounded-lg p-2 bg-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {availableColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 hidden sm:block">
                  {numericalColumns.includes(yAxis) ? 'Numerical data - Good choice!' : 
                   'Categorical data - Usually better for X-axis'}
                </p>
              </div>
              {((chartType === 'composed' || chartType === 'bubble' || chartType === 'heatmap') || (autoMode && (recommendedChart === 'composed' || recommendedChart === 'bubble' || recommendedChart === 'heatmap'))) && (
                <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                  <label className="text-xs sm:text-sm font-medium text-gray-300">
                    {chartType === 'bubble' ? 'Bubble Size' : 
                     chartType === 'heatmap' ? 'Intensity Value' : 'Secondary Y-Axis'}
                  </label>
                  <select
                    value={secondaryYAxis}
                    onChange={(e) => setSecondaryYAxis(e.target.value)}
                    className="w-full border border-gray-600 rounded-lg p-2 bg-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {availableColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 hidden sm:block">
                    {chartType === 'heatmap' ? 
                      (numericalColumns.includes(secondaryYAxis) ? 'Numerical data - Perfect for intensity!' : 'Categorical data - Consider using numerical data for better heatmap') :
                      (numericalColumns.includes(secondaryYAxis) ? 'Numerical data - Good choice!' : 
                       'Categorical data - Not recommended for Y-axis')
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {showOptions && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
              {/* Chart Type Selection */}
              <div className="bg-gray-700/50 p-4 rounded-xl border border-gray-600 max-h-60 overflow-y-auto">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-medium text-white">Chart Type Selection</h3>
                  <button
                    onClick={() => setShowOptions(false)}
                    className="text-gray-400 hover:text-white p-1 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {compatibleCharts.map(option => (
                    <button
                      key={option.type}
                      onClick={() => {
                        setChartType(option.type);
                        setAutoMode(false);
                        setShowOptions(false); // Close options after selection
                      }}
                      disabled={!option.compatible}
                      className={`flex flex-col items-center space-y-1 px-2 py-2 rounded-lg transition-all relative text-xs ${
                        chartType === option.type && !autoMode 
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md' 
                          : option.compatible 
                            ? 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600 hover:text-white' 
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                      } ${option.recommended ? 'ring-1 ring-emerald-400' : ''}`}
                    >
                      {option.icon}
                      <span className="text-center leading-tight">{option.label}</span>
                      {option.recommended && (
                        <div className="absolute -top-1 -right-1 bg-emerald-500 text-white p-0.5 rounded-full">
                          <Check className="h-2 w-2" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  <p>💡 Tip: Charts with green rings are recommended for your data</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Chart Visualization */}
          <div className="bg-gray-700/30 p-2 sm:p-4 rounded-xl h-64 sm:h-80 lg:h-96 mb-2 flex items-center justify-center border border-gray-600">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {renderAutoChart()}
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 text-center">
                <p className="text-sm">Select valid axes to display chart</p>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-gray-400 hidden sm:block">
            <p>You can change the axes and data dimensions regardless of the selected chart type</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Use Portal to render modal at document body level, ensuring it appears above all content
  if (!isMounted) return null;
  
  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null;
} 