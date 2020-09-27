import { BarLineChartBase } from './BarLineChartBase';
import { AxisDependency } from '../components/YAxis';
import { BarData } from '../data/BarData';
import { BarEntry } from '../data/BarEntry';
import { BarDataProvider } from '../interfaces/dataprovider/BarDataProvider';
import { Entry } from '../data/Entry';
import { BarDataSet } from '../data/BarDataSet';
import { BarHighlighter } from '../highlight/BarHighlighter';
import { Highlight } from '../highlight/Highlight';
import { BarChartRenderer } from '../renderer/BarChartRenderer';
import { RectF } from '@nativescript-community/ui-canvas';

const LOG_TAG = 'BarChart';

export class BarChart extends BarLineChartBase<Entry, BarDataSet, BarData> implements BarDataProvider {
    /**
     * flag that indicates whether the highlight should be full-bar oriented, or single-value?
     */
    protected mHighlightFullBarEnabled = false;

    protected mFitBars = false;

    /**
     * if set to true, all values are drawn above their bars, instead of below their top
     */
    private mDrawValueAboveBar = true;

    /**
     * if set to true, a grey area is drawn behind each bar that indicates the maximum value
     */
    private mDrawBarShadow = false;

    protected init() {
        super.init();

        this.mRenderer = new BarChartRenderer(this, this.mAnimator, this.mViewPortHandler);

        this.setHighlighter(new BarHighlighter(this));

        this.getXAxis().setSpaceMin(0.5);
        this.getXAxis().setSpaceMax(0.5);
    }

    protected calcMinMax() {
        if (this.mFitBars) {
            this.mXAxis.calculate(this.mData.getXMin() - this.mData.getBarWidth() / 2, this.mData.getXMax() + this.mData.getBarWidth() / 2);
        } else {
            this.mXAxis.calculate(this.mData.getXMin(), this.mData.getXMax());
        }

        // calculate axis range (min / max) according to provided data
        this.mAxisLeft.calculate(this.mData.getYMin(AxisDependency.LEFT), this.mData.getYMax(AxisDependency.LEFT));
        this.mAxisRight.calculate(this.mData.getYMin(AxisDependency.RIGHT), this.mData.getYMax(AxisDependency.RIGHT));
    }

    /**
     * Returns the Highlight object (contains x-index and DataSet index) of the selected value at the given touch
     * point
     * inside the BarChart.
     *
     * @param x
     * @param y
     * @return
     */
    public getHighlightByTouchPoint(x: number, y: number): Highlight {
        if (this.mData == null) {
            console.error(LOG_TAG, "Can't select by touch. No data set.");
            return null;
        }

        const h = this.getHighlighter().getHighlight(x, y);
        if (h === null || !this.isHighlightFullBarEnabled()) {
            return h;
        }

        // For isHighlightFullBarEnabled, remove stackIndex
        return {
            x: h.x,
            y: h.y,
            xPx: h.xPx,
            yPx: h.yPx,
            dataSetIndex: h.dataSetIndex,
            axis: h.axis,
        };
    }

    /**
     * Returns the bounding box of the specified Entry in the specified DataSet. Returns null if the Entry could not be
     * found in the charts data.
     *
     * @param e
     * @return
     */
    public getBarBounds(e: BarEntry): RectF {
        const set = this.mData.getDataSetForEntry(e);
        if (set === null) {
            return new RectF(Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
        }

        const xKey = set.xProperty;
        const yKey = set.yProperty;

        const y = e[xKey];
        const x = e[yKey];

        const barWidth = this.mData.getBarWidth();

        const left = x - barWidth / 2;
        const right = x + barWidth / 2;
        const top = y >= 0 ? y : 0;
        const bottom = y <= 0 ? y : 0;

        const outputRect = new RectF(left, top, right, bottom);
        this.getTransformer(set.getAxisDependency()).rectValueToPixel(outputRect);
        return outputRect;
    }

    /**
     * If set to true, all values are drawn above their bars, instead of below their top.
     *
     * @param enabled
     */
    public setDrawValueAboveBar(enabled: boolean) {
        this.mDrawValueAboveBar = enabled;
    }

    /**
     * returns true if drawing values above bars is enabled, false if not
     *
     * @return
     */
    public isDrawValueAboveBarEnabled() {
        return this.mDrawValueAboveBar;
    }

    /**
     * If set to true, a grey area is drawn behind each bar that indicates the maximum value. Enabling his will reduce
     * performance by about 50%.
     *
     * @param enabled
     */
    public setDrawBarShadow(enabled: boolean) {
        this.mDrawBarShadow = enabled;
    }

    /**
     * returns true if drawing shadows (maxvalue) for each bar is enabled, false if not
     *
     * @return
     */
    public isDrawBarShadowEnabled() {
        return this.mDrawBarShadow;
    }

    /**
     * Set this to true to make the highlight operation full-bar oriented, false to make it highlight single values (relevant
     * only for stacked). If enabled, highlighting operations will highlight the whole bar, even if only a single stack entry
     * was tapped.
     * Default: false
     *
     * @param enabled
     */
    public setHighlightFullBarEnabled(enabled: boolean) {
        this.mHighlightFullBarEnabled = enabled;
    }

    /**
     * @return true the highlight operation is be full-bar oriented, false if single-value
     */

    public isHighlightFullBarEnabled() {
        return this.mHighlightFullBarEnabled;
    }

    /**
     * Highlights the value at the given x-value in the given DataSet. Provide
     * -1 as the dataSetIndex to undo all highlighting.
     *
     * @param x
     * @param dataSetIndex
     * @param stackIndex   the index inside the stack - only relevant for stacked entries
     * @param callListener
     */
    public highlightValue(x: number, dataSetIndex: number, stackIndex: number, callListener = false) {
        this.highlight({ x, y: 0, dataSetIndex, stackIndex }, callListener);
    }

    public getBarData(): BarData {
        return this.mData;
    }

    /**
     * Adds half of the bar width to each side of the x-axis range in order to allow the bars of the barchart to be
     * fully displayed.
     * Default: false
     *
     * @param enabled
     */
    public setFitBars(enabled: boolean) {
        this.mFitBars = enabled;
    }

    /**
     * Groups all BarDataSet objects this data object holds together by modifying the x-value of their entries.
     * Previously set x-values of entries will be overwritten. Leaves space between bars and groups as specified
     * by the parameters.
     * Calls notifyDataSetChanged() afterwards.
     *
     * @param fromX      the starting polet on the x-axis where the grouping should begin
     * @param groupSpace the space between groups of bars in values (not pixels) e.g. 0.8f for bar width 1
     * @param barSpace   the space between individual bars in values (not pixels) e.g. 0.1 for bar width 1
     */
    public groupBars(fromX, groupSpace, barSpace) {
        if (this.getBarData() === null) {
            throw new Error('You need to set data for the chart before grouping bars.');
        } else {
            this.getBarData().groupBars(fromX, groupSpace, barSpace);
            this.notifyDataSetChanged();
        }
    }
}
