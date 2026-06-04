import { it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ShareCardArt } from './ShareCardArt'

it('無照片：用漸層底並顯示課表/標題/stat', () => {
  const { container, getByText } = render(
    <ShareCardArt photoUrl={null} gradient="linear-gradient(135deg, #E8B800, #333)"
      stat={<span>平均 1:24</span>} chart={<svg role="img" aria-label="圖" />}
      planText="3k @4:10" caption="好濕不好吃" />,
  )
  expect(getByText('3k @4:10')).toBeInTheDocument()
  expect(getByText('好濕不好吃')).toBeInTheDocument()
  expect(getByText('平均 1:24')).toBeInTheDocument()
  expect(container.querySelector('img')).toBeNull()
})

it('有照片：渲染 img', () => {
  const { container } = render(
    <ShareCardArt photoUrl="blob:abc" gradient="x" stat={null} chart={null} planText="" caption="" />,
  )
  expect(container.querySelector('img')).toBeTruthy()
})
