import { ChartHighlighter } from './ChartHighlighter';
import { Highlight } from './Highlight';
import { BarData } from '../data/BarData';
import { BarDataProvider } from '../interfaces/dataprovider/BarDataProvider';
import { IBarDataSet } from '../interfaces/datasets/IBarDataSet';

export class BarHighlighter extends ChartHighlighter<BarDataProvider>
{
    constructor(chart: BarDataProvider)
    {
        super(chart);
    }
    
    public getHighlight(x: number, y: number): Highlight
    {
        const high = super.getHighlight(x, y);
        if(high === null)
        {
            return null;
        }

        const pos = this.getValsForTouch(x, y);
        const barData = this.mChart.getBarData();

        let set = barData.getDataSetByIndex(high.dataSetIndex);
        if (set.isStacked())
        {
            return this.getStackedHighlight(high, set, pos.x, pos.y);
        }

        // MPPointD.recycleInstance(pos);

        return high;
    }

    /**
     * This method creates the Highlight object that also indicates which value of a stacked BarEntry has been
     * selected.
     *
     * @param high the Highlight to work with looking for stacked values
     * @param set
     * @param xVal
     * @param yVal
     * @return
     */
    public getStackedHighlight(high: Highlight, set: IBarDataSet, xVal, yVal): Highlight
    {
        const entry = set.getEntryForXValue(xVal, yVal);
        if (entry == null)
        {
            return null;
        }

        // not stacked
        if (entry.yVals == null)
        {
            return high;
        }

        const ranges = entry.ranges;
        if (ranges.length > 0)
        {
            const xProperty = set.xProperty;
            const yProperty = set.yProperty;
            let stackIndex = this.getClosestStackIndex(ranges, yVal);
            let pixels = this.mChart.getTransformer(set.getAxisDependency()).getPixelForValues(high.x, ranges[stackIndex][1]);

            //MPPointD.recycleInstance(pixels);

            return {
                x: entry[xProperty],
                y: entry[yProperty],
                xPx: pixels.x,
                yPx: pixels.y,
                dataSetIndex: high.dataSetIndex,
                stackIndex: stackIndex,
                axis: high.axis
            };
        }

        return null;
    }

    /**
     * Returns the index of the closest value inside the values array / ranges (stacked barchart) to the value
     * given as
     * a parameter.
     *
     * @param ranges
     * @param value
     * @return
     */
    protected getClosestStackIndex(ranges: Array<any>, value): number
    {
        if (ranges === null || ranges.length == 0)
        {
            return 0;
        }

        for (let i = 0; i < ranges.length; i++)
        {
            if (ranges[i].includes(value))
            {
                return i;
            }
        }

        let length = Math.max(ranges.length - 1, 0);
        return (value > ranges[length][1]) ? length : 0;
    }

    protected getDistance(x1, y1, x2, y2): number
    {
        return Math.abs(x1 - x2);
    }

    
    protected getData(): BarData
    {
        return this.mChart.getBarData();
    }
}
