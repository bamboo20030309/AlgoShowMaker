const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile, load } = require('./helpers/compile');

const source = `#include <bits/stdc++.h>
using namespace std;
int n=100;
vector<int> isprime(n+5,1);
vector<int> prime;
void prime_table() {
  isprime[0]=isprime[1]=0;
  // @frame
  // @object isprime with range(1,n), columns(10), labels(index)
  // @object prime with columns(10), labels(value)
  // @place prime.top-left at isprime.bottom-left offset(0,60)
  // @style isprime[1] background rgba(223,127,255)
  // @style isprime[1] highlight
  for(int i=2;i<=n;i++){
    // @frame
    // @object isprime[i] with range(1,n), columns(10), labels(index)
    // @object prime with columns(10), labels(value)
    // @place prime.top-left at isprime.bottom-left offset(0,60)
    // @style isprime[1:n] focus when value == 1
    if(isprime[i])prime.push_back(i);
    // @frame
    // @object isprime[i] with range(1,n), columns(10), labels(index)
    // @object prime with columns(10), labels(value)
    // @place prime.top-left at isprime.bottom-left offset(0,60)
    // @style isprime[1:n] focus when value == 1
    for(int j=0;j<prime.size();j++){
      // @frame
      // @object isprime[i] with range(1,n), columns(10), labels(index)
      // @object prime with columns(10), labels(value)
      // @place prime.top-left at isprime.bottom-left offset(0,60)
      // @style isprime[1:n] focus when value == 1
      // @style isprime[i,i*prime[j]] highlight
      // @style prime[j] highlight
      // @arrow from isprime[i] to prime[j] color rgba(13,102,13,0.8) width 3
      if(i*prime[j]>n)break;
      isprime[i*prime[j]]=0;
      // @frame when i%prime[j]==0 && j<prime.size()-1
      // @object isprime[i] with range(1,n), columns(10), labels(index)
      // @object prime with columns(10), labels(value)
      // @place prime.top-left at isprime.bottom-left offset(0,60)
      // @style isprime[1:n] focus when value == 1
      // @style isprime[i,i*prime[j+1]] highlight
      // @style prime[j+1] highlight
      // @arrow from isprime[i] to prime[j+1] color rgba(255,0,0,0.7) width 3
      if(i%prime[j]==0)break;
    }
  }
}
int main(){
  cin>>n;
  // @frame
  // @object isprime with range(1,n), columns(10), labels(index)
  // @object prime with columns(10), labels(value)
  // @place prime.top-left at isprime.bottom-left offset(0,60)
  prime_table();
  // @frame
  // @object isprime with range(1,n), columns(10), labels(index)
  // @object prime with columns(10), labels(value)
  // @place prime.top-left at isprime.bottom-left offset(0,60)
  return 0;
}`;

test('Euler comparison without a visible animation target does not color code', async () => {
  const { trace, context } = await compile(source, '10\n');
  load(context, 'trace-code-model.js');
  context.addEventListener = () => {};
  load(context, 'trace-code-presenter.js');
  context.ASMTraceEvents.applyEnabledStates(trace);
  assert.ok(trace.frames.length >= 6);
  for (const [index, comparisonText] of [[2, 'i<=n'], [4, 'j<prime.size()'], [5, 'i*prime[j]>n']]) {
    const frame = trace.frames[index];
    const compare = frame.events.find(event => event.type === 'compare'
      && event.source?.text?.replace(/\s+/g, '') === comparisonText);
    assert.ok(compare, `frame ${index + 1}: ${comparisonText} comparison exists`);
    const condition = frame.events.find(event => event.type === 'condition'
      && event.source?.from <= compare.source?.from && event.source?.to >= compare.source?.to);
    assert.ok(condition, `frame ${index + 1}: linked condition exists`);
    const plan = context.ASMTraceCodeModel.planFrame(trace, frame);
    assert.ok(plan.fragments.flatMap(fragment => fragment.items || []).some(item =>
      item.segments?.some(segment => segment.eventIds?.includes(compare.id))),
    `frame ${index + 1}: comparison is linked to visible code`);
    // The canvas hides at least one required variable in these frames. The
    // player therefore disables the comparison even though its instruction
    // switch remains enabled by default.
    compare.autoAnimationDisabled = true;
    const events = new Map(frame.events.map(event => [event.id, event]));
    const completed = new Set([compare.id, condition.id]);
    const visual = context.ASMTraceCodePresenter.visualStateForIds(
      [compare.id, condition.id], events, completed, completed, compare.id
    );
    assert.equal(visual.active, false);
    assert.equal(visual.pending, false);
    assert.equal(visual.complete, false);
    assert.equal(visual.conditionResult, undefined);
    compare.autoAnimationDisabled = false;
    assert.equal(context.ASMTraceCodePresenter.visualStateForIds(
      [compare.id, condition.id], events, completed, completed, compare.id
    ).conditionResult, condition.result);
    compare.enabled = false;
    assert.equal(context.ASMTraceCodePresenter.visualStateForIds(
      [compare.id, condition.id], events, completed, completed, compare.id
    ).conditionResult, undefined);
  }
});
