'use client';

import { Container, Row, Col, Card, DropdownItem } from 'react-bootstrap';
import Header from './components/Header';
import Footer from './components/Footer';
import { Button, Dropdown, Modal, Input, Select, TextField, Badge, Banner, Breadcrumb } from './components/ui';
import { useState } from 'react';

export default function Home() {
  const [showModal, setShowModal] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      
      <main className="flex-grow-1">
        {/* Hero Section */}
        <section className="py-5" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <Container>
            <Row className="text-center">
              <Col>
                <h1 className="display-4 fw-bold mb-3">John Overton</h1>
                <p className="lead text-secondary-custom mb-4">
                  Welcome to my personal website
                </p>
                <div className="d-flex gap-3 justify-content-center flex-wrap">
                  <Button variant="primary">Get Started</Button>
                  <Button variant="outline-primary">Learn More</Button>
                </div>
              </Col>
            </Row>
          </Container>
        </section>

        {/* Breadcrumb Example */}
        <section className="py-3 border-bottom">
          <Container>
            <Breadcrumb 
              items={[
                { label: 'Home', href: '/' },
                { label: 'About', href: '#about' },
                { label: 'Current Page', active: true }
              ]} 
            />
          </Container>
        </section>

        {/* Banner Example */}
        {showBanner && (
          <section className="py-3">
            <Container>
              <Banner 
                variant="info" 
                dismissible 
                onClose={() => setShowBanner(false)}
              >
                <strong>Welcome!</strong> This is a sample banner message. You can dismiss it by clicking the X.
              </Banner>
            </Container>
          </section>
        )}

        {/* Components Showcase */}
        <section className="py-5" id="about">
          <Container>
            <Row>
              <Col>
                <h2 className="text-center mb-5">Component Showcase</h2>
              </Col>
            </Row>

            {/* Buttons */}
            <Row className="mb-5">
              <Col>
                <h3 className="mb-4">Buttons</h3>
                <div className="d-flex gap-3 flex-wrap">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="success">Success</Button>
                  <Button variant="warning">Warning</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="outline-primary">Outline Primary</Button>
                  <Button variant="outline-secondary">Outline Secondary</Button>
                </div>
              </Col>
            </Row>

            {/* Dropdowns */}
            <Row className="mb-5">
              <Col>
                <h3 className="mb-4">Dropdowns</h3>
                <div className="d-flex gap-3 flex-wrap">
                  <Dropdown title="Primary Menu" variant="primary">
                    <DropdownItem href="#action1">Action 1</DropdownItem>
                    <DropdownItem href="#action2">Action 2</DropdownItem>
                    <DropdownItem href="#action3">Action 3</DropdownItem>
                  </Dropdown>
                  <Dropdown title="Secondary Menu" variant="secondary">
                    <DropdownItem href="#action1">Option 1</DropdownItem>
                    <DropdownItem href="#action2">Option 2</DropdownItem>
                  </Dropdown>
                </div>
              </Col>
            </Row>

            {/* Badges */}
            <Row className="mb-5">
              <Col>
                <h3 className="mb-4">Badges</h3>
                <div className="d-flex gap-2 flex-wrap">
                  <Badge variant="primary">Primary</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="danger">Danger</Badge>
                  <Badge variant="info">Info</Badge>
                </div>
              </Col>
            </Row>

            {/* Form Elements */}
            <Row className="mb-5">
              <Col md={6}>
                <h3 className="mb-4">Form Elements</h3>
                <Input 
                  label="Text Input"
                  placeholder="Enter your name"
                />
                <Select 
                  label="Select Dropdown"
                  options={[
                    { value: '', label: 'Choose an option' },
                    { value: '1', label: 'Option 1' },
                    { value: '2', label: 'Option 2' },
                    { value: '3', label: 'Option 3' }
                  ]}
                />
                <TextField 
                  label="Text Area"
                  placeholder="Enter your message"
                  rows={4}
                />
                <Button variant="primary">Submit Form</Button>
              </Col>
            </Row>

            {/* Cards */}
            <Row className="mb-5">
              <Col>
                <h3 className="mb-4">Cards</h3>
                <Row>
                  <Col md={4} className="mb-4">
                    <Card className="card-custom h-100">
                      <Card.Body>
                        <Card.Title>Card Title 1</Card.Title>
                        <Card.Text>
                          This is a sample card with minimalist styling. It demonstrates the card component with custom styling.
                        </Card.Text>
                        <Button variant="primary" size="sm">Learn More</Button>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={4} className="mb-4">
                    <Card className="card-custom h-100">
                      <Card.Body>
                        <Card.Title>Card Title 2</Card.Title>
                        <Card.Text>
                          Another example card showcasing the clean design aesthetic of the website.
                        </Card.Text>
                        <Button variant="secondary" size="sm">Read More</Button>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={4} className="mb-4">
                    <Card className="card-custom h-100">
                      <Card.Body>
                        <Card.Title>Card Title 3</Card.Title>
                        <Card.Text>
                          A third card example to demonstrate consistency across the component library.
                        </Card.Text>
                        <Button variant="success" size="sm">Explore</Button>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Col>
            </Row>

            {/* Modal Trigger */}
            <Row className="mb-5">
              <Col>
                <h3 className="mb-4">Modals</h3>
                <Button variant="primary" onClick={() => setShowModal(true)}>
                  Open Modal
                </Button>
                <Modal
                  show={showModal}
                  onHide={() => setShowModal(false)}
                  title="Sample Modal"
                  footer={
                    <>
                      <Button variant="secondary" onClick={() => setShowModal(false)}>
                        Close
                      </Button>
                      <Button variant="primary" onClick={() => setShowModal(false)}>
                        Save Changes
                      </Button>
                    </>
                  }
                >
                  <p>This is a sample modal dialog. You can add any content here.</p>
                  <p>Modals are useful for displaying important information or collecting user input.</p>
                </Modal>
              </Col>
            </Row>

            {/* Banners */}
            <Row className="mb-5">
              <Col>
                <h3 className="mb-4">Banners & Alerts</h3>
                <div className="d-flex flex-column gap-3">
                  <Banner variant="success">
                    <strong>Success!</strong> This is a success banner message.
                  </Banner>
                  <Banner variant="info">
                    <strong>Info:</strong> This is an informational banner message.
                  </Banner>
                  <Banner variant="warning">
                    <strong>Warning:</strong> This is a warning banner message.
                  </Banner>
                  <Banner variant="danger">
                    <strong>Error:</strong> This is an error banner message.
                  </Banner>
                </div>
              </Col>
            </Row>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}
