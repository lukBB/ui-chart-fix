import { Canvas, Paint, Style } from '@nativescript-community/ui-canvas';
import { Color } from '@nativescript/core';
import { ChartAnimator } from '../animation/ChartAnimator';
import { BubbleChart } from '../charts/BubbleChart';
import { BubbleDataSet } from '../data/BubbleDataSet';
import { BubbleEntry } from '../data/BubbleEntry';
import { Highlight } from '../highlight/Highlight';
import { Utils } from '../utils/Utils';
import { ViewPortHandler } from '../utils/ViewPortHandler';
import { BarLineScatterCandleBubbleRenderer } from './BarLineScatterCandleBubbleRenderer';

/**
 * Bubble chart implementation: Copyright 2015 Pierre-Marc Airoldi Licensed
 * under Apache License 2.0 Ported by Daniel Cohen Gindi
 */
export class BubbleChartRenderer extends BarLineScatterCandleBubbleRenderer {
    mChart: BubbleChart;

    constructor(chart: BubbleChart, animator: ChartAnimator, viewPortHandler: ViewPortHandler) {
        super(animator, viewPortHandler);
        this.mChart = chart;
    }

    public get highlightPaint() {
        if (!this.mHighlightPaint) {
            this.mHighlightPaint = Utils.getTemplatePaint('black-stroke');
            // set alpha after color
            this.mHighlightPaint.setAlpha(120);
            this.mHighlightPaint.setStrokeWidth(1.5);
        }
        return this.mHighlightPaint;
    }

    public drawData(c: Canvas) {
        const bubbleData = this.mChart.getBubbleData();

        for (const set of bubbleData.getDataSets()) {
            if (set.isVisible()) {
                this.drawDataSet(c, set);
            }
        }
    }

    protected getShapeSize(entrySize, maxSize, reference, normalizeSize: boolean) {
        const factor = normalizeSize ? (maxSize === 0 ? 1 : Math.sqrt(entrySize / maxSize)) : entrySize;
        const shapeSize = reference * factor;
        return shapeSize;
    }

    protected drawDataSet(c: Canvas, dataSet: BubbleDataSet) {
        if (dataSet.getEntryCount() < 1) return;
        const yKey = dataSet.yProperty;
        const trans = this.mChart.getTransformer(dataSet.getAxisDependency());

        const phaseY = this.mAnimator.getPhaseY();

        this.mXBounds.set(this.mChart, dataSet, this.mAnimator);
        const sizeBuffer = Utils.getTempArray(4);
        sizeBuffer[0] = 0;
        sizeBuffer[1] = 0;
        sizeBuffer[2] = 1;
        sizeBuffer[3] = 0;

        trans.pointValuesToPixel(sizeBuffer);

        const normalizeSize = dataSet.isNormalizeSizeEnabled();

        // calcualte the full width of 1 step on the x-axis
        const maxBubbleWidth = Math.abs(sizeBuffer[2] - sizeBuffer[0]);
        const maxBubbleHeight = Math.abs(this.mViewPortHandler.contentBottom() - this.mViewPortHandler.contentTop());
        const referenceSize = Math.min(maxBubbleHeight, maxBubbleWidth);
        const maxSize = dataSet.getMaxSize();
        const customRender = this.mChart.getCustomRenderer();
        const renderPaint = this.renderPaint;
        const previousShader = renderPaint.getShader();
        const shader = dataSet.getFillShader();
        if (shader) {
            renderPaint.setShader(shader);
        }
        const pointBuffer = Utils.getTempArray(2);
        for (let j = this.mXBounds.min; j <= this.mXBounds.range + this.mXBounds.min; j++) {
            const entry = dataSet.getEntryForIndex(j);
            const xValue = dataSet.getEntryXValue(entry, j);
            pointBuffer[0] = xValue;
            pointBuffer[1] = entry[yKey] * phaseY;
            trans.pointValuesToPixel(pointBuffer);

            const shapeHalf = this.getShapeSize(entry[dataSet.sizeProperty], maxSize, referenceSize, normalizeSize) / 2;

            if (!this.mViewPortHandler.isInBoundsTop(pointBuffer[1] + shapeHalf) || !this.mViewPortHandler.isInBoundsBottom(pointBuffer[1] - shapeHalf)) continue;

            if (!this.mViewPortHandler.isInBoundsLeft(pointBuffer[0] + shapeHalf)) continue;

            if (!this.mViewPortHandler.isInBoundsRight(pointBuffer[0] - shapeHalf)) break;

            const color = dataSet.getColor(xValue);
            renderPaint.setColor(color);
            if (customRender && customRender.drawBubble) {
                customRender.drawBubble(c, entry, pointBuffer[0], pointBuffer[1], shapeHalf, renderPaint);
            } else {
                c.drawCircle(pointBuffer[0], pointBuffer[1], shapeHalf, renderPaint);
            }
        }
        renderPaint.setShader(previousShader);
    }

    public drawValues(c: Canvas) {
        const data = this.mChart.getBubbleData();
        const dataSets = data.getDataSets();
        if (!this.isDrawingValuesAllowed(this.mChart) || dataSets.some((d) => d.isDrawValuesEnabled() || d.isDrawIconsEnabled()) === false) {
            return;
        }

        // if values are drawn

        const paint = this.valuePaint;
        const lineHeight = Utils.calcTextHeight(paint, '1');

        const customRender = this.mChart.getCustomRenderer();
        for (let i = 0; i < dataSets.length; i++) {
            const dataSet = dataSets[i];
            if (!this.shouldDrawValues(dataSet) || dataSet.getEntryCount() < 1) continue;

            // apply the text-styling defined by the DataSet
            this.applyValueTextStyle(dataSet);

            const phaseX = Math.max(0, Math.min(1, this.mAnimator.getPhaseX()));
            const phaseY = this.mAnimator.getPhaseY();

            this.mXBounds.set(this.mChart, dataSet, this.mAnimator);

            const { points, count } = this.mChart.getTransformer(dataSet.getAxisDependency()).generateTransformedValuesBubble(dataSet, phaseY, this.mXBounds.min, this.mXBounds.max);

            const alpha = phaseX === 1 ? phaseY : phaseX;

            const formatter = dataSet.getValueFormatter();

            const iconsOffset = dataSet.getIconsOffset();
            const valuesOffset = dataSet.getValuesOffset();
            const isDrawValuesEnabled = dataSet.isDrawValuesEnabled();
            const isDrawIconsEnabled = dataSet.isDrawIconsEnabled();
            for (let j = 0; j < count; j += 2) {
                let valueTextColor = dataSet.getValueTextColor(j / 2 + this.mXBounds.min);
                if (!(valueTextColor instanceof Color)) {
                    valueTextColor = new Color(valueTextColor);
                }
                if (alpha !== 1) {
                    valueTextColor = new Color(Math.round(255 * alpha), valueTextColor.r, valueTextColor.g, valueTextColor.b);
                }

                const x = points[j];
                const y = points[j + 1];

                if (!this.mViewPortHandler.isInBoundsRight(x)) break;

                if (!this.mViewPortHandler.isInBoundsLeft(x) || !this.mViewPortHandler.isInBoundsY(y)) continue;

                const entry = dataSet.getEntryForIndex(j / 2 + this.mXBounds.min);

                if (isDrawValuesEnabled) {
                    this.drawValue(c, formatter.getBubbleLabel(entry[dataSet.sizeProperty], entry), x + valuesOffset.x, y + valuesOffset.y + 0.5 * lineHeight, valueTextColor, paint, customRender);
                }

                if (entry.icon && isDrawIconsEnabled) {
                    Utils.drawIcon(c, this.mChart, entry.icon, x + iconsOffset.x, y + iconsOffset.y);
                }
            }
        }
    }

    public drawExtras(c: Canvas) {}

    public drawHighlighted(c: Canvas, indices: Highlight[]) {
        const bubbleData = this.mChart.getBubbleData();

        const phaseY = this.mAnimator.getPhaseY();

        let entry: BubbleEntry, index: number;
        const customRender = this.mChart.getCustomRenderer();
        const pointBuffer = Utils.getTempArray(2);
        const sizeBuffer = Utils.getTempArray(4);
        for (const high of indices) {
            const set = bubbleData.getDataSetByIndex(high.dataSetIndex);
            const yKey = set.yProperty;

            if (set == null || !set.isHighlightEnabled()) {
                continue;
            }

            if (high.entry) {
                entry = high.entry as BubbleEntry;
                index = high.entryIndex;
            } else {
                const r = set.getEntryAndIndexForXValue(high.x, high.y);
                entry = r.entry;
                index = r.index;
            }

            if (entry[yKey] !== high.y) continue;

            if (!this.isInBoundsX(entry, set)) continue;

            const trans = this.mChart.getTransformer(set.getAxisDependency());

            sizeBuffer[0] = 0;
            sizeBuffer[1] = 0;
            sizeBuffer[2] = 1;
            sizeBuffer[3] = 0;

            trans.pointValuesToPixel(sizeBuffer);

            const normalizeSize = set.isNormalizeSizeEnabled();

            // calcualte the full width of 1 step on the x-axis
            const maxBubbleWidth = Math.abs(sizeBuffer[2] - sizeBuffer[0]);
            const maxBubbleHeight = Math.abs(this.mViewPortHandler.contentBottom() - this.mViewPortHandler.contentTop());
            const referenceSize = Math.min(maxBubbleHeight, maxBubbleWidth);

            pointBuffer[0] = set.getEntryXValue(entry, index);
            pointBuffer[1] = entry[yKey] * phaseY;
            trans.pointValuesToPixel(pointBuffer);

            high.drawX = pointBuffer[0];
            high.drawY = pointBuffer[1];

            const shapeHalf = this.getShapeSize(entry[set.sizeProperty], set.getMaxSize(), referenceSize, normalizeSize) / 2;

            if (!this.mViewPortHandler.isInBoundsTop(pointBuffer[1] + shapeHalf) || !this.mViewPortHandler.isInBoundsBottom(pointBuffer[1] - shapeHalf)) continue;

            if (!this.mViewPortHandler.isInBoundsLeft(pointBuffer[0] + shapeHalf)) continue;

            if (!this.mViewPortHandler.isInBoundsRight(pointBuffer[0] - shapeHalf)) break;

            let originalColor = set.getColor(set.getEntryXValue(entry, index)) as Color;
            if (!(originalColor instanceof Color)) {
                originalColor = new Color(originalColor);
            }

            const paint = this.highlightPaint;
            paint.setColor(set.getHighLightColor());
            paint.setStrokeWidth(set.getHighlightCircleWidth());

            if (customRender && customRender.drawHighlight) {
                customRender.drawHighlight(c, high, pointBuffer[0], pointBuffer[1], shapeHalf, paint);
            } else {
                c.drawCircle(pointBuffer[0], pointBuffer[1], shapeHalf, paint);
            }
        }
    }
}
